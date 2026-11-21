import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { OpenCodeAdapter } from '../src/core/adapters/opencode.mjs';
import { getAdapter, listAdapters } from '../src/core/adapters/index.mjs';
import { Installer } from '../src/core/installer.mjs';
import { emptyManifest } from '../src/core/manifest.mjs';
import { FRAMEWORK_ROOT } from '../src/core/paths.mjs';
import { loadSkillCatalog } from '../src/core/skills.mjs';
import { exists } from '../src/util/fsx.mjs';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function gitInit(root) {
  await execFileAsync('git', ['init', '-q', root]);
}

async function install(adapter) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-opencode-'));
  const actions = await adapter.plan({ root, frameworkRoot: FRAMEWORK_ROOT, config: {}, withHooks: false });
  const installer = new Installer({ root, manifest: emptyManifest() });
  await installer.apply(actions);
  return { root, actions };
}

test('adapter registry exposes qoder, generic and opencode', () => {
  assert.deepEqual(listAdapters().map((a) => a.key), ['qoder', 'generic', 'opencode']);
  assert.equal(getAdapter('opencode').name, 'OpenCode');
});

test('opencode plan writes AGENTS.md and every built-in skill under .opencode/skills', async () => {
  const adapter = new OpenCodeAdapter();
  const { root, actions } = await install(adapter);
  const paths = actions.map((a) => a.path);
  assert.ok(paths.includes('AGENTS.md'));
  const catalog = await loadSkillCatalog(FRAMEWORK_ROOT);
  assert.equal(paths.filter((p) => p.startsWith('.opencode/skills/') && p.endsWith('/SKILL.md')).length, catalog.length);
  for (const skill of catalog) {
    assert.ok(await exists(path.join(root, '.opencode', 'skills', skill.name, 'SKILL.md')));
  }
  const agents = await fsp.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /<!-- AIDF:BEGIN/);
});

test('opencode verification is CONTRACT-PROVEN and never claims runtime discovery', async () => {
  const adapter = new OpenCodeAdapter();
  const { root } = await install(adapter);
  await gitInit(root);
  const result = await adapter.verify({ root, frameworkRoot: FRAMEWORK_ROOT });
  assert.equal(result.status, 'CONTRACT-PROVEN');
  assert.equal(result.checks.find((c) => c.id === 'runtime-skill-discovery').status, 'NOT_PROVEN');
  assert.equal(result.checks.find((c) => c.id === 'skill-files').status, 'PASS');
  assert.equal(result.checks.find((c) => c.id === 'git-worktree').status, 'PASS');
});

test('opencode verification is PARTIAL outside a git worktree', async () => {
  const adapter = new OpenCodeAdapter();
  const { root } = await install(adapter);
  const result = await adapter.verify({ root, frameworkRoot: FRAMEWORK_ROOT });
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.checks.find((c) => c.id === 'git-worktree').status, 'PARTIAL');
});

test('opencode verification fails when skills are missing', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-opencode-empty-'));
  const result = await new OpenCodeAdapter().verify({ root, frameworkRoot: FRAMEWORK_ROOT });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.checks.find((c) => c.id === 'agents-md-block').status, 'FAIL');
});
