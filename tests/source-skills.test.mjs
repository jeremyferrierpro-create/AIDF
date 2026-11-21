import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import {
  catalogSourceSkills, markDuplicates, summarizeSourceSkills, selectSourceSkills,
  copySourceSkill, skillInstallTarget,
} from '../src/core/source-skills.mjs';

function inventory(overrides = {}) {
  return {
    resources: [
      {
        id: 'mit-res',
        license: 'MIT',
        licensePolicy: { redistribution: 'allowed', copy: true },
        path: 'C:/virtual/mit',
        files: [
          { path: 'skills/demo/SKILL.md' },
          { path: 'skills/demo/references/guide.md' },
          { path: 'skills/demo/scripts/build.sh' },
          { path: 'skills/demo/.env' },
        ],
        skills: [
          { name: 'demo', path: 'skills/demo/SKILL.md', sha256: 'aaa', valid: true, description: 'UI design audit helper.' },
        ],
      },
      {
        id: 'unknown-res',
        license: 'unknown',
        licensePolicy: { redistribution: 'blocked', copy: false },
        path: 'C:/virtual/unknown',
        files: [],
        skills: [
          { name: 'hidden', path: 'skills/hidden/SKILL.md', sha256: 'bbb', valid: true, description: 'Indexed only.' },
        ],
      },
      {
        id: 'gpl-res',
        license: 'GPL-2.0',
        licensePolicy: { redistribution: 'blocked-in-mit-distribution', copy: false },
        path: 'C:/virtual/gpl',
        files: [],
        skills: [
          { name: 'pencil-designer', path: 'skills/pencil/SKILL.md', sha256: 'ccc', valid: true, description: 'Excluded.' },
        ],
      },
      ...(overrides.extra ?? []),
    ],
  };
}

test('catalogue derives status from licence policy', () => {
  const entries = catalogSourceSkills(inventory().resources);
  const byId = new Map(entries.map((e) => [e.id, e]));
  assert.equal(byId.get('demo').status, 'AVAILABLE');
  assert.equal(byId.get('hidden').status, 'INDEX_ONLY');
  assert.equal(byId.get('pencil-designer').status, 'INDEX_ONLY');
  assert.equal(summarizeSourceSkills(entries).unique, 3);
});

test('invalid skills are INCOMPATIBLE regardless of licence', () => {
  const entries = catalogSourceSkills([{
    id: 'r', license: 'MIT', licensePolicy: { redistribution: 'allowed', copy: true }, path: 'C:/x',
    files: [], skills: [{ name: 'broken', path: 'b/SKILL.md', sha256: '1', valid: false, errors: ['bad'], description: '' }],
  }]);
  assert.equal(entries[0].status, 'INCOMPATIBLE');
  assert.match(entries[0].reason, /bad/);
});

test('duplicate names keep one canonical AVAILABLE entry', () => {
  const entries = catalogSourceSkills(inventory({
    extra: [{
      id: 'second',
      license: 'MIT',
      licensePolicy: { redistribution: 'allowed', copy: true },
      path: 'C:/virtual/second',
      files: [],
      skills: [{ name: 'demo', path: 'skills/demo/SKILL.md', sha256: 'aaa', valid: true, description: 'Dup.' }],
    }],
  }).resources);
  const demos = entries.filter((e) => e.id === 'demo');
  assert.equal(demos.length, 2);
  assert.equal(demos.filter((e) => e.canonical).length, 1);
  assert.ok(demos.some((e) => e.status === 'DUPLICATE'));
});

test('markDuplicates is idempotent for unique entries', () => {
  const entries = [{ id: 'a', path: 'a', valid: true, status: 'AVAILABLE' }];
  assert.deepEqual(markDuplicates(entries).map((e) => e.status), ['AVAILABLE']);
});

test('selection is deterministic and ignores index-only skills', () => {
  const entries = catalogSourceSkills(inventory().resources);
  const selected = selectSourceSkills(entries, 'audit UI design for accessibility');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'demo');
  assert.equal(selectSourceSkills(entries, 'audit UI design').length, 1);
});

test('copy refuses index-only skills', async () => {
  const entries = catalogSourceSkills(inventory().resources);
  const hidden = entries.find((e) => e.id === 'hidden');
  const result = await copySourceSkill(hidden, inventory(), 'C:/virtual/target');
  assert.equal(result.status, 'BLOCKED');
});

test('copy copies support files but never secrets or executables by default', async () => {
  const source = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-skill-src-'));
  const skillDir = path.join(source, 'skills', 'demo');
  await fsp.mkdir(path.join(skillDir, 'references'), { recursive: true });
  await fsp.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
  await fsp.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: demo\ndescription: Demo skill.\n---\n\nBody.\n');
  await fsp.writeFile(path.join(skillDir, 'references', 'guide.md'), '# Guide\n');
  await fsp.writeFile(path.join(skillDir, 'scripts', 'build.sh'), 'echo unsafe\n');
  await fsp.writeFile(path.join(skillDir, '.env'), 'SECRET=1\n');

  const inv = inventory();
  inv.resources[0] = { ...inv.resources[0], path: source };
  const entries = catalogSourceSkills(inv.resources);
  const demo = entries.find((e) => e.id === 'demo');
  const target = path.join(await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-skill-dst-')), 'demo');
  const result = await copySourceSkill(demo, inv, target);
  assert.equal(result.status, 'COPIED');
  assert.equal(result.files, 2);
  assert.ok(await fsp.stat(path.join(target, 'SKILL.md')));
  assert.ok(await fsp.stat(path.join(target, 'references', 'guide.md')));
  await assert.rejects(fsp.stat(path.join(target, 'scripts', 'build.sh')));
  await assert.rejects(fsp.stat(path.join(target, '.env')));
  const provenance = JSON.parse(await fsp.readFile(path.join(target, 'AIDF-SOURCE.json'), 'utf8'));
  assert.equal(provenance.license, 'MIT');
  assert.equal(provenance.scriptsCopied, false);
});

test('install target follows the adapter', () => {
  assert.ok(skillInstallTarget('C:/p', 'opencode', 'demo').includes('.opencode'));
  assert.ok(skillInstallTarget('C:/p', 'qoder', 'demo').includes('.qoder'));
  assert.ok(skillInstallTarget('C:/p', 'generic', 'demo').includes('.aidf'));
});
