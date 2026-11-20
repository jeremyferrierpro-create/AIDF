import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import {
  validateSkillContent, buildSkillRegistry, findDependencyCycles, summarizeSkills,
  loadSkillCatalog, SKILL_STATUSES,
} from '../src/core/skills.mjs';
import { FRAMEWORK_ROOT } from '../src/core/paths.mjs';

const frameworkRoot = FRAMEWORK_ROOT;

async function projectWithSkills() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-skills-'));
  await fsp.cp(path.join(frameworkRoot, 'assets', 'skills'), path.join(root, '.qoder', 'skills'), { recursive: true });
  return root;
}

test('validates a real first-party skill', async () => {
  const content = await fsp.readFile(path.join(frameworkRoot, 'assets', 'skills', 'aidf-project-context', 'SKILL.md'), 'utf8');
  const result = validateSkillContent(content, { directoryName: 'aidf-project-context' });
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.name, 'aidf-project-context');
  assert.ok(result.description.length <= 1024);
});

test('rejects invalid names, missing and oversized descriptions', () => {
  assert.equal(validateSkillContent('no frontmatter').valid, false);
  const badName = validateSkillContent('---\nname: Bad Name\ndescription: x\n---\nbody text that is long enough');
  assert.equal(badName.valid, false);
  const noDescription = validateSkillContent('---\nname: valid-name\n---\nbody text that is long enough');
  assert.equal(noDescription.valid, false);
  const tooLong = validateSkillContent(`---\nname: valid-name\ndescription: ${'x'.repeat(1025)}\n---\nbody`);
  assert.equal(tooLong.valid, false);
});

test('builds a registry where every installed builtin skill is AVAILABLE', async () => {
  const root = await projectWithSkills();
  const registry = await buildSkillRegistry(root, { adapter: 'qoder', frameworkRoot });
  assert.equal(registry.skills.filter((s) => s.source === 'builtin').length, 13);
  const notAvailable = registry.skills.filter((s) => s.source === 'builtin' && s.status !== 'AVAILABLE');
  assert.deepEqual(notAvailable.map((s) => `${s.id}:${s.status}:${s.errors.join('|')}`), []);
  assert.equal(registry.summary.AVAILABLE, 13);
  for (const skill of registry.skills.filter((s) => s.source === 'builtin')) {
    assert.ok(skill.path.endsWith(`${skill.name}/SKILL.md`));
    assert.match(skill.hash, /^[a-f0-9]{64}$/);
  }
});

test('marks duplicate skill names as BLOCKED', async () => {
  const root = await projectWithSkills();
  await fsp.cp(
    path.join(frameworkRoot, 'assets', 'skills', 'aidf-project-context'),
    path.join(root, '.aidf', 'skills', 'aidf-project-context'),
    { recursive: true },
  );
  const registry = await buildSkillRegistry(root, { adapter: 'qoder', frameworkRoot });
  const entry = registry.skills.find((s) => s.id === 'project-context');
  assert.equal(entry.status, 'BLOCKED');
  assert.ok(entry.warnings.some((w) => w.includes('Duplicate')));
});

test('catalog and status vocabulary are consistent', async () => {
  const catalog = await loadSkillCatalog(frameworkRoot);
  assert.equal(catalog.length, 13);
  assert.deepEqual(SKILL_STATUSES, ['DISCOVERED', 'VALIDATED', 'REGISTERED', 'AVAILABLE', 'BLOCKED', 'INCOMPATIBLE']);
  const summary = summarizeSkills([{ status: 'AVAILABLE' }, { status: 'AVAILABLE' }, { status: 'BLOCKED' }]);
  assert.equal(summary.AVAILABLE, 2);
  assert.equal(summary.BLOCKED, 1);
  assert.equal(summary.total, 3);
});

test('detects dependency cycles', () => {
  const cycles = findDependencyCycles({
    a: { requires: ['b'] },
    b: { requires: ['c'] },
    c: { requires: ['a'] },
    d: { requires: [] },
  });
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0], ['a', 'b', 'c', 'a']);
});
