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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-cli-'));
  await fsp.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'cli-demo', version: '1.0.0', scripts: { test: 'node --version' } }, null, 2),
    'utf8',
  );
  await fsp.writeFile(path.join(root, 'AGENTS.md'), '# Existing rules\n\nKeep this line.\n', 'utf8');
  await fsp.mkdir(path.join(root, '.qoder', 'rules'), { recursive: true });
  await fsp.writeFile(path.join(root, '.qoder', 'rules', 'existing.md'), '# Existing\n', 'utf8');
  await fsp.writeFile(path.join(root, '.env'), 'SECRET_TOKEN=do-not-print\n', 'utf8');
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
  } catch (error) {
    throw new Error(`Invalid JSON output (code ${result.code}):\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
}

test('end-to-end install, verify, scan, validate and uninstall', { timeout: 180000 }, async () => {
  const root = await project();

  const dry = await run(['install', '--target', root, '--adapter', 'qoder', '--with-hooks', '--dry-run', '--json']);
  assert.equal(dry.code, 0, dry.stderr);
  assert.equal(await fsp.stat(path.join(root, '.aidf')).then(() => true).catch(() => false), false);
  const dryJson = parseJson(dry);
  assert.ok(dryJson.summary.would > 100);

  const install = await run(['install', '--target', root, '--adapter', 'qoder', '--with-hooks', '--json']);
  assert.equal(install.code, 0, install.stderr);
  const installed = parseJson(install);
  assert.ok(installed.summary.created > 100);
  assert.equal(installed.summary.failed, 0);

  const agents = await fsp.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('Keep this line.'));
  assert.ok(agents.includes('AIDF:BEGIN'));
  assert.ok(await fsp.stat(path.join(root, '.aidf/manifest.json')));
  assert.ok(await fsp.stat(path.join(root, '.aidf/framework/src/cli.mjs')));
  assert.ok(await fsp.stat(path.join(root, '.qoder/skills/aidf-project-context/SKILL.md')));
  assert.ok(await fsp.stat(path.join(root, '.qoder/agents/aidf-orchestrator.md')));

  const doctor = await run(['doctor', '--target', root, '--json']);
  assert.equal(doctor.code, 0, doctor.stderr);
  const doctorJson = parseJson(doctor);
  assert.ok(doctorJson.checks.every((c) => c.status !== 'FAIL'));
  assert.equal(doctorJson.skills.AVAILABLE, 13);

  const scan = await run(['scan', '--target', root, '--record', '--json']);
  assert.equal(scan.code, 0, scan.stderr);
  const scanJson = parseJson(scan);
  assert.ok(scanJson.scan.secretFiles.includes('.env'));
  assert.ok(!scan.stdout.includes('do-not-print'));
  assert.ok(scanJson.evidence.file);

  const skills = await run(['skills', 'validate', '--target', root, '--json']);
  assert.equal(skills.code, 0, skills.stderr);
  assert.equal(parseJson(skills).validation.valid, true);

  const context = await run(['context', '--target', root, '--task', 'add an API endpoint with a database migration', '--json']);
  assert.equal(context.code, 0, context.stderr);
  const contextJson = parseJson(context);
  assert.equal(contextJson.context.status, 'OK');
  assert.ok(contextJson.context.skills.some((s) => s.name === 'aidf-backend-implementation'));
  assert.ok(contextJson.context.documents.some((d) => d.id === 'BACKEND'));

  const gate = await run(['validate', '--gate', 'intake-entry', '--target', root, '--json']);
  assert.equal(gate.code, 0, gate.stderr);
  assert.equal(parseJson(gate).status, 'PASS');

  const config = await run(['config', 'set', 'security.allowCommandExecution', 'false', '--target', root]);
  assert.equal(config.code, 0, config.stderr);
  const configGet = await run(['config', 'get', 'security.allowCommandExecution', '--target', root]);
  assert.equal(configGet.stdout.trim(), 'false');

  const speckit = await run(['speckit', 'status', '--target', root, '--json']);
  assert.equal(speckit.code, 0, speckit.stderr);
  assert.equal(parseJson(speckit).present, false);

  const resources = await run(['resources', 'inspect', '--target', root, '--json']);
  assert.equal(resources.code, 0, resources.stderr);
  assert.ok(Array.isArray(parseJson(resources)));

  const refused = await run(['uninstall', '--target', root]);
  assert.equal(refused.code, 1);

  const preview = await run(['uninstall', '--target', root, '--dry-run', '--json']);
  assert.equal(preview.code, 0, preview.stderr);
  assert.ok(parseJson(preview).results.some((r) => r.status === 'WOULD_REMOVE'));

  const uninstall = await run(['uninstall', '--target', root, '--yes', '--json']);
  assert.equal(uninstall.code, 0, uninstall.stderr);
  assert.equal(await fsp.stat(path.join(root, '.aidf')).then(() => true).catch(() => false), false);
  const remainingAgents = await fsp.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(remainingAgents.includes('Keep this line.'));
  assert.ok(!remainingAgents.includes('AIDF:BEGIN'));
  assert.ok(await fsp.stat(path.join(root, '.qoder/rules/existing.md')));
  assert.equal(await fsp.stat(path.join(root, '.qoder/rules/aidf-00-core.md')).then(() => true).catch(() => false), false);
  assert.ok(await fsp.stat(path.join(root, '.env')));
});
