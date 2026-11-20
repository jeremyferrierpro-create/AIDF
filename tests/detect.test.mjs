import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { detectProject, detectEnvironment, runTool } from '../src/core/detect.mjs';

async function project() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-detect-'));
  await fsp.writeFile(path.join(root, 'tsconfig.json'), '{ "compilerOptions": {} }\n', 'utf8');
  await fsp.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'detected',
      version: '2.0.0',
      dependencies: { react: '^18.0.0', express: '^4.0.0' },
      devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0', '@playwright/test': '^1.0.0' },
      scripts: { test: 'vitest run' },
    }, null, 2),
    'utf8',
  );
  await fsp.mkdir(path.join(root, 'tests'), { recursive: true });
  await fsp.mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
  await fsp.writeFile(path.join(root, 'AGENTS.md'), '# rules\n', 'utf8');
  await fsp.mkdir(path.join(root, '.qoder', 'rules'), { recursive: true });
  return root;
}

test('detectProject reports real markers, frameworks, test runners and CI', async () => {
  const root = await project();
  const detected = await detectProject(root);
  assert.ok(detected.languages.some((l) => l.language === 'TypeScript'));
  assert.ok(detected.languages.some((l) => l.ecosystem === 'node'));
  assert.ok(detected.frameworks.includes('React'));
  assert.ok(detected.frameworks.includes('Express'));
  assert.ok(detected.tests.runners.includes('vitest'));
  assert.ok(detected.tests.runners.includes('playwright'));
  assert.ok(detected.tests.runners.includes('npm:test'));
  assert.deepEqual(detected.tests.directories, ['tests']);
  assert.deepEqual(detected.ci, ['.github/workflows']);
  assert.equal(detected.aiConfig.agentsMd, true);
  assert.equal(detected.aiConfig.qoderRules, true);
  assert.equal(detected.git.repository, false);
});

test('detectProject returns empty structures for an empty project', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-detect-empty-'));
  const detected = await detectProject(root);
  assert.deepEqual(detected.languages, []);
  assert.deepEqual(detected.frameworks, []);
  assert.deepEqual(detected.tests.runners, []);
  assert.equal(detected.git.repository, false);
});

test('detectEnvironment exposes tools and IDE/Spec Kit probes without inventing values', async () => {
  const env = await detectEnvironment();
  assert.match(env.node.version, /^\d+\./);
  assert.equal(typeof env.tools, 'object');
  assert.equal(typeof env.ide.qoder.installed, 'boolean');
  assert.ok(Object.hasOwn(env.specKit, 'cliPath'));
  const probe = await runTool('node', ['--version']);
  assert.equal(probe.ok, true);
  assert.match(probe.stdout, /^v\d+/);
});
