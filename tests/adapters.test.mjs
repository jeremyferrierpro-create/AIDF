import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { QoderAdapter } from '../src/core/adapters/qoder.mjs';
import { GenericAdapter } from '../src/core/adapters/generic.mjs';
import { getAdapter, listAdapters } from '../src/core/adapters/index.mjs';
import { Installer } from '../src/core/installer.mjs';
import { emptyManifest } from '../src/core/manifest.mjs';
import { FRAMEWORK_ROOT } from '../src/core/paths.mjs';
import { exists } from '../src/util/fsx.mjs';

const frameworkRoot = FRAMEWORK_ROOT;

async function installAdapter(adapter, withHooks = false) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-adapter-'));
  const actions = await adapter.plan({ root, frameworkRoot, config: {}, withHooks });
  const installer = new Installer({ root, manifest: emptyManifest() });
  await installer.apply(actions);
  return { root, actions, manifest: installer.manifest };
}

test('registry exposes qoder and generic adapters', () => {
  assert.deepEqual(listAdapters().map((a) => a.key), ['qoder', 'generic']);
  assert.equal(getAdapter('qoder').name, 'Qoder IDE');
  assert.throws(() => getAdapter('unknown'), /Unknown adapter/);
});

test('qoder plan writes rules, skills, agent and optional hooks', async () => {
  const adapter = new QoderAdapter();
  const { root, actions } = await installAdapter(adapter, true);
  const paths = actions.map((a) => a.path);
  assert.ok(paths.includes('AGENTS.md'));
  assert.ok(paths.includes('.qoder/rules/aidf-00-core.md'));
  assert.ok(paths.includes('.qoder/rules/aidf-10-security.md'));
  assert.ok(paths.includes('.qoder/rules/aidf-20-context.md'));
  assert.ok(paths.includes('.qoder/agents/aidf-orchestrator.md'));
  assert.ok(paths.includes('.qoder/skills/aidf-project-context/SKILL.md'));
  assert.ok(paths.includes('.aidf/hooks/session-context.mjs'));
  assert.ok(paths.includes('.qoder/settings.json'));
  assert.equal(paths.filter((p) => p.startsWith('.qoder/skills/') && p.endsWith('/SKILL.md')).length, 13);

  const settings = JSON.parse(await fsp.readFile(path.join(root, '.qoder/settings.json'), 'utf8'));
  assert.ok(settings.hooks.SessionStart);
  assert.ok(settings.hooks.PostToolUse);
  assert.ok(await exists(path.join(root, '.qoder/agents/aidf-orchestrator.md')));
});

test('qoder verification is CONTRACT-PROVEN, never PROVEN at runtime', async () => {
  const adapter = new QoderAdapter();
  const { root } = await installAdapter(adapter, true);
  const result = await adapter.verify({
    root,
    frameworkRoot,
    withHooks: true,
    env: { ide: { qoder: { installed: true, home: 'C:/Users/demo/.qoder' } } },
  });
  assert.equal(result.status, 'CONTRACT-PROVEN');
  assert.equal(result.checks.find((c) => c.id === 'runtime-skill-discovery').status, 'NOT_PROVEN');
  assert.equal(result.checks.find((c) => c.id === 'runtime-rule-activation').status, 'NOT_PROVEN');
  assert.equal(result.checks.find((c) => c.id === 'runtime-hook-activation').status, 'NOT_PROVEN');
  assert.ok(result.checks.find((c) => c.id === 'rule-files').limitation.includes('UI'));
});

test('qoder verification fails when a rule or skill is missing', async () => {
  const adapter = new QoderAdapter();
  const { root } = await installAdapter(adapter, false);
  await fsp.rm(path.join(root, '.qoder/rules/aidf-00-core.md'));
  const result = await adapter.verify({ root, frameworkRoot, env: { ide: { qoder: { installed: true } } } });
  assert.equal(result.status, 'FAIL');
});

test('generic adapter only manages the AGENTS.md block', async () => {
  const adapter = new GenericAdapter();
  const { root, actions } = await installAdapter(adapter, false);
  assert.deepEqual(actions.map((a) => a.path), ['AGENTS.md']);
  const result = await adapter.verify({ root, frameworkRoot });
  assert.equal(result.status, 'PROVEN');
  const text = await fsp.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(text.includes('AIDF:BEGIN'));
  assert.ok(text.includes('AIDF:END'));
});
