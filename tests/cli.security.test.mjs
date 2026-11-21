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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-sec-'));
  await fsp.mkdir(path.join(root, '.aidf'), { recursive: true });
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

test('security analyze generates, persists and shows a STRIDE threat model', { timeout: 60000 }, async () => {
  const root = await project();
  await fsp.writeFile(path.join(root, 'package.json'), JSON.stringify({
    name: 'demo', version: '1.0.0',
    dependencies: { express: '^4.0.0' },
  }));
  await fsp.writeFile(path.join(root, '.env'), 'SECRET=placeholder\n');

  const dry = await run(['security', 'analyze', '--target', root, '--json']);
  assert.equal(dry.code, 0, dry.stderr);
  const dryJson = parseJson(dry);
  assert.equal(dryJson.threatModel.id, 'TM-001');
  assert.equal(dryJson.threatModel.status, 'DRAFT');
  assert.equal(dryJson.artefact, null);
  const strides = dryJson.threatModel.threats.map((t) => t.stride);
  assert.ok(strides.includes('Information Disclosure'));
  assert.ok(strides.includes('Spoofing'));
  assert.ok(strides.includes('Tampering'));

  const write = await run(['security', 'analyze', '--target', root, '--write', '--markdown', '--json']);
  assert.equal(write.code, 0, write.stderr);
  const written = parseJson(write);
  assert.ok(written.artefact);
  const tmFile = path.join(root, '.aidf', 'artefacts', 'security', 'threat-model.json');
  const tm = JSON.parse(await fsp.readFile(tmFile, 'utf8'));
  assert.equal(tm.id, 'TM-001');
  assert.ok(tm.threats.some((t) => t.stride === 'Information Disclosure' && t.status === 'open'));

  const mdPath = path.join(root, '.aidf', 'reports', 'THREAT-MODEL.md');
  const md = await fsp.readFile(mdPath, 'utf8');
  assert.ok(md.includes('# Threat Model TM-001'));

  // The nested artefact must be visible to artefacts list (recursive discovery).
  const list = await run(['artefacts', 'list', '--target', root, '--json']);
  assert.equal(list.code, 0, list.stderr);
  assert.ok(parseJson(list).artefacts.some((a) => a.id === 'TM-001'));

  const show = await run(['security', 'show', '--target', root, '--json']);
  assert.equal(show.code, 0, show.stderr);
  assert.equal(parseJson(show).id, 'TM-001');

  const validate = await run(['artefacts', 'validate', 'TM-001', '--target', root, '--json']);
  assert.equal(validate.code, 0, validate.stderr);
  assert.equal(parseJson(validate).results[0].valid, true);
});

test('tests plan generates cases from requirements and coverage reports them', { timeout: 60000 }, async () => {
  const root = await project();

  const add = await run([
    'requirements', 'add', '--target', root, '--type', 'FUNCTIONAL',
    '--title', 'API returns user profile', '--priority', 'must',
    '--ac', JSON.stringify(['GET /users/:id returns 200 with profile', 'returns 404 for unknown id']), '--json',
  ]);
  assert.equal(add.code, 0, add.stderr);

  const plan = await run(['tests', 'plan', '--target', root, '--write', '--json']);
  assert.equal(plan.code, 0, plan.stderr);
  const planJson = parseJson(plan);
  assert.equal(planJson.testPlan.id, 'TP-001');
  assert.equal(planJson.testPlan.testCases.length, 2);
  assert.deepEqual(planJson.testPlan.links.covers, ['REQ-F-001']);
  assert.ok(planJson.testPlan.testCases.every((tc) => tc.status === 'planned'));
  assert.ok(planJson.testPlan.testCases.every((tc) => tc.requirement === 'REQ-F-001'));

  const planFile = path.join(root, '.aidf', 'artefacts', 'test-plan.json');
  assert.ok(await fsp.stat(planFile).then(() => true).catch(() => false));

  const list = await run(['artefacts', 'list', '--target', root, '--json']);
  assert.ok(parseJson(list).artefacts.some((a) => a.id === 'TP-001'));

  const coverage = await run(['tests', 'coverage', '--target', root, '--json']);
  assert.equal(coverage.code, 0, coverage.stderr);
  const cov = parseJson(coverage);
  assert.equal(cov.covered, 1);
  assert.equal(cov.total, 1);
  assert.equal(cov.details[0].plannedCases.length, 2);
});

test('artefacts in subdirectories resolve in links and listing', { timeout: 60000 }, async () => {
  const root = await project();
  const decisionsDir = path.join(root, '.aidf', 'artefacts', 'decisions');
  await fsp.mkdir(decisionsDir, { recursive: true });
  const now = new Date().toISOString();
  const base = {
    schemaVersion: '1.0.0', createdAt: now, updatedAt: now, status: 'DRAFT',
    source: { type: 'human', author: 'test', createdAt: now },
    links: {}, validation: { schemaVersion: '1.0.0', timestamp: now, valid: true, errors: [], warnings: [] },
  };
  await fsp.writeFile(path.join(decisionsDir, 'ADR-001.json'), JSON.stringify({
    ...base, id: 'ADR-001', type: 'decision', title: 'nested decision',
  }));

  const list = await run(['artefacts', 'list', '--target', root, '--json']);
  assert.equal(list.code, 0, list.stderr);
  assert.ok(parseJson(list).artefacts.some((a) => a.id === 'ADR-001'));

  const show = await run(['artefacts', 'show', 'ADR-001', '--target', root, '--json']);
  assert.equal(show.code, 0, show.stderr);
  assert.equal(parseJson(show).id, 'ADR-001');
});
