import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BIN = path.resolve(import.meta.dirname, '..', 'bin', 'aidf.mjs');

async function run(args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [BIN, ...args], {
      cwd: options.cwd,
      env: { ...process.env, AIDF_LOG_LEVEL: 'error' },
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

/**
 * Simulate an AIDF 0.1.0 project: manifest claiming version 0.1.0, hand-kept
 * project documents and an AGENTS.md with user content.
 */
async function legacyProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-legacy-'));
  await fsp.mkdir(path.join(root, '.aidf', 'docs'), { recursive: true });
  await fsp.writeFile(path.join(root, 'AGENTS.md'), '# My project\n\nUser-written instructions.\n', 'utf8');
  await fsp.writeFile(
    path.join(root, '.aidf', 'docs', 'PRD.md'),
    '---\ndoc: PRD\nstatus: DRAFT\n---\n\nLEGACY-0.1.0-PRD-CONTENT\n',
    'utf8',
  );
  await fsp.writeFile(
    path.join(root, '.aidf', 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      framework: { name: 'aidf', version: '0.1.0' },
      project: { name: 'legacy-app', slug: 'legacy-app' },
      adapter: 'generic',
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      files: {},
      managedBlocks: {},
      links: {},
      backups: [],
      history: [{ ts: '2026-01-01T00:00:00.000Z', event: 'install', version: '0.1.0', adapter: 'generic' }],
    }, null, 2),
    'utf8',
  );
  return root;
}

test('0.1.0 project upgrades additively: files preserved, engines usable', { timeout: 120000 }, async () => {
  const root = await legacyProject();
  const prdBefore = await fsp.readFile(path.join(root, '.aidf', 'docs', 'PRD.md'), 'utf8');
  const agentsBefore = await fsp.readFile(path.join(root, 'AGENTS.md'), 'utf8');

  const install = await run(['install', '--target', root, '--adapter', 'generic']);
  assert.equal(install.code, 0, install.stderr);

  // Legacy content is preserved verbatim.
  const prdAfter = await fsp.readFile(path.join(root, '.aidf', 'docs', 'PRD.md'), 'utf8');
  assert.ok(prdAfter.includes('LEGACY-0.1.0-PRD-CONTENT'));
  const agentsAfter = await fsp.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agentsAfter.includes('User-written instructions.'));
  assert.ok(agentsAfter.includes('AIDF:BEGIN') || agentsAfter.includes('AIDF'));

  const manifest = JSON.parse(await fsp.readFile(path.join(root, '.aidf', 'manifest.json'), 'utf8'));
  assert.ok(manifest.history.length >= 2, 'install history appended');
  assert.ok(Object.keys(manifest.files).length > 0, 'managed files recorded');

  // Re-running is idempotent: no conflicts on a second pass.
  const update = await run(['update', '--target', root, '--adapter', 'generic', '--json']);
  assert.equal(update.code, 0, update.stderr);
  const summary = JSON.parse(update.stdout).summary;
  assert.equal(summary.conflicts, 0);
  assert.equal(summary.failed, 0);

  // 0.2.0 engines work on the migrated project.
  const req = await run([
    'requirements', 'add', '--target', root, '--type', 'FUNCTIONAL',
    '--title', 'Migrated requirement', '--ac', 'criterion', '--json',
  ]);
  assert.equal(req.code, 0, req.stderr);

  const tm = await run(['security', 'analyze', '--target', root, '--write', '--json']);
  assert.equal(tm.code, 0, tm.stderr);
  assert.ok(JSON.parse(tm.stdout).threatModel.id.startsWith('TM-'));

  const plan = await run(['tests', 'plan', '--target', root, '--write']);
  assert.equal(plan.code, 0, plan.stderr);

  const docs = await run(['docs', 'generate', '--target', root]);
  assert.equal(docs.code, 0, docs.stderr);
  assert.ok(await fsp.stat(path.join(root, '.aidf', 'docs', 'generated', 'REQUIREMENTS.md')).then(() => true).catch(() => false));
});
