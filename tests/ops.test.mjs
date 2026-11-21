import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BIN = path.resolve(import.meta.dirname, '..', 'bin', 'aidf.mjs');

async function project() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-ops-'));
  await fsp.mkdir(path.join(root, '.aidf', 'workflows'), { recursive: true });
  await fsp.mkdir(path.join(root, '.aidf', 'state'), { recursive: true });
  await fsp.writeFile(
    path.join(root, '.aidf', 'manifest.json'),
    JSON.stringify({ schemaVersion: 1, framework: { name: 'aidf', version: '0.2.0' } }),
    'utf8',
  );
  return root;
}

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

function parseJson(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid JSON (code ${result.code}):\n${result.stdout}\n${result.stderr}`);
  }
}

const PIPELINE = `schemaVersion: 1
pipeline:
  steps:
    - id: build
      kind: build
      name: Build
      command: "node -e \\"require('fs').writeFileSync('build.txt','ok')\\""
      blocking: true
    - id: deploy
      kind: deploy
      name: Deploy
      command: "node -e \\"require('fs').writeFileSync('deployed.txt','v1')\\""
      blocking: true
  rollback:
    - id: rollback-deploy
      name: Rollback
      command: "node -e \\"require('fs').writeFileSync('rolledback.txt','yes')\\""
`;

test('ops init writes a template and plan lists steps without executing', { timeout: 60000 }, async () => {
  const root = await project();

  const init = await run(['ops', 'init', '--target', root]);
  assert.equal(init.code, 0, init.stderr);
  const file = path.join(root, '.aidf', 'workflows', 'pipeline.yaml');
  assert.ok(await fsp.stat(file).then(() => true).catch(() => false));

  // Template has empty commands → plan reports validation errors honestly.
  const plan = await run(['ops', 'plan', '--target', root]);
  assert.equal(plan.code, 1);

  // Second init without --force refuses to overwrite.
  const again = await run(['ops', 'init', '--target', root]);
  assert.equal(again.code, 1);
});

test('ops run refuses execution without --allow-exec and executes with it', { timeout: 60000 }, async () => {
  const root = await project();
  await fsp.writeFile(path.join(root, '.aidf', 'workflows', 'pipeline.yaml'), PIPELINE, 'utf8');

  // No permission: NOT_PROVEN, nothing executed.
  const denied = await run(['ops', 'run', '--target', root, '--json']);
  assert.equal(denied.code, 1);
  const deniedRes = parseJson(denied);
  assert.equal(deniedRes.run.verdict, 'NOT_PROVEN');
  assert.equal(deniedRes.run.steps[0].status, 'NOT_PROVEN');
  assert.ok(!(await fsp.stat(path.join(root, 'build.txt')).then(() => true).catch(() => false)));

  // With permission: steps run for real, deploy recorded for rollback.
  const allowed = await run(['ops', 'run', '--target', root, '--allow-exec', '--record', '--json']);
  assert.equal(allowed.code, 0, allowed.stderr);
  const res = parseJson(allowed);
  assert.equal(res.run.verdict, 'PASS');
  assert.equal(res.run.steps.length, 2);
  assert.ok(res.evidence);
  assert.equal(await fsp.readFile(path.join(root, 'build.txt'), 'utf8'), 'ok');
  assert.equal(await fsp.readFile(path.join(root, 'deployed.txt'), 'utf8'), 'v1');

  // Rollback executes the recorded rollback commands.
  const rb = await run(['ops', 'rollback', '--target', root, '--allow-exec', '--record', '--json']);
  assert.equal(rb.code, 0, rb.stderr);
  const rbRes = parseJson(rb);
  assert.equal(rbRes.run.verdict, 'PASS');
  assert.equal(rbRes.run.rolledBackRun, res.run.runId);
  assert.equal(await fsp.readFile(path.join(root, 'rolledback.txt'), 'utf8'), 'yes');
});

test('ops run stops on first failure and reports honestly', { timeout: 60000 }, async () => {
  const root = await project();
  await fsp.writeFile(path.join(root, '.aidf', 'workflows', 'pipeline.yaml'), `schemaVersion: 1
pipeline:
  steps:
    - id: bad
      kind: build
      command: "node -e \\"process.exit(3)\\""
    - id: never
      kind: deploy
      command: "node -e \\"process.exit(0)\\""
`, 'utf8');

  const res = await run(['ops', 'run', '--target', root, '--allow-exec', '--json']);
  assert.equal(res.code, 1);
  const parsed = parseJson(res);
  assert.equal(parsed.run.verdict, 'FAIL');
  assert.equal(parsed.run.stoppedAt, 'bad');
  assert.equal(parsed.run.steps.length, 1);

  // Shell operators are rejected → BLOCKED, not executed.
  await fsp.writeFile(path.join(root, '.aidf', 'workflows', 'pipeline.yaml'), `schemaVersion: 1
pipeline:
  steps:
    - id: evil
      kind: custom
      command: "node -e \\"x\\" && echo pwned"
`, 'utf8');
  const blocked = await run(['ops', 'run', '--target', root, '--allow-exec', '--json']);
  const blockedRes = parseJson(blocked);
  assert.equal(blockedRes.run.verdict, 'BLOCKED');
});
