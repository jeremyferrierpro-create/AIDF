import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readJson, writeJson, ensureDir } from '../src/util/fsx.mjs';
import { recordEvidence } from '../src/core/evidence.mjs';

const execFileAsync = promisify(execFile);
const BIN = path.resolve(import.meta.dirname, '..', 'bin', 'aidf.mjs');

async function run(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [BIN, ...args], {
      env: { ...process.env, AIDF_LOG_LEVEL: 'error' },
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

function json(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label}: invalid JSON\n${result.stdout}\n${result.stderr}`);
  }
}

async function installedProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-doctor-'));
  await fsp.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'doctor-demo', version: '1.0.0' }), 'utf8');
  const install = await run(['install', '--target', root, '--adapter', 'qoder', '--json']);
  assert.equal(install.code, 0, install.stderr);
  return root;
}

test('doctor passes on a healthy fresh install and reports adapter limits', async () => {
  const root = await installedProject();
  const result = await run(['doctor', '--target', root, '--json']);
  assert.equal(result.code, 0, result.stderr);
  const report = json(result, 'doctor');
  assert.equal(report.checks.some((c) => c.status === 'FAIL'), false);
  assert.ok(report.checks.find((c) => c.id === 'documents'));
  assert.ok(report.checks.find((c) => c.id === 'evidence-integrity').status === 'PASS');
  assert.ok(report.checks.find((c) => c.id === 'document-files').status === 'PASS');
});

test('doctor fails when config claims a status the document file does not have', async () => {
  const root = await installedProject();
  const configFile = path.join(root, '.aidf', 'config.json');
  const config = await readJson(configFile, null);
  config.documents.PRD.status = 'VALIDATED';
  config.documents.PRD.validatedBy = 'Jeremy';
  await writeJson(configFile, config);
  const result = await run(['doctor', '--target', root, '--json']);
  assert.equal(result.code, 1);
  const report = json(result, 'doctor');
  const documents = report.checks.find((c) => c.id === 'documents');
  assert.equal(documents.status, 'FAIL');
  assert.match(documents.detail, /PRD/);
});

test('doctor warns about declared-only approvals without failing', async () => {
  const root = await installedProject();
  await ensureDir(path.join(root, '.aidf', 'evidence'));
  await recordEvidence(root, {
    type: 'security-review', status: 'PASS', humanApproval: true, approvedBy: 'Jeremy', summary: 'declared',
  });
  const result = await run(['doctor', '--target', root, '--json']);
  assert.equal(result.code, 0, result.stderr);
  const report = json(result, 'doctor');
  const approvals = report.checks.find((c) => c.id === 'approvals');
  assert.equal(approvals.status, 'WARN');
  assert.match(approvals.detail, /not authenticated/);
});

test('doctor fails when an evidence record is tampered', async () => {
  const root = await installedProject();
  await ensureDir(path.join(root, '.aidf', 'evidence'));
  const evidence = await recordEvidence(root, { type: 'test-run', status: 'PASS', summary: 'ok' });
  const file = path.join(root, evidence.file);
  const body = await readJson(file, null);
  body.summary = 'tampered';
  await writeJson(file, body);
  const result = await run(['doctor', '--target', root, '--json']);
  assert.equal(result.code, 1);
  const report = json(result, 'doctor');
  const integrity = report.checks.find((c) => c.id === 'evidence-integrity');
  assert.equal(integrity.status, 'FAIL');
  assert.ok(integrity.problems.some((p) => p.includes('HASH_MISMATCH')));
});

test('doctor reports a broken chain, not just a bad file hash', async () => {
  const root = await installedProject();
  await ensureDir(path.join(root, '.aidf', 'evidence'));
  await recordEvidence(root, { type: 'test-run', status: 'PASS', summary: 'first' });
  await recordEvidence(root, { type: 'test-run', status: 'PASS', summary: 'second' });
  const indexFile = path.join(root, '.aidf', 'evidence', 'index.json');
  const index = await readJson(indexFile, null);
  index.entries[1].previous = 'broken';
  index.entries[1].hash = 'broken';
  index.lastHash = 'broken';
  await writeJson(indexFile, index);
  const result = await run(['doctor', '--target', root, '--json']);
  assert.equal(result.code, 1);
  const report = json(result, 'doctor');
  const integrity = report.checks.find((c) => c.id === 'evidence-integrity');
  assert.equal(integrity.status, 'FAIL');
  assert.ok(integrity.problems.some((p) => p.includes('INDEX_HASH_MISMATCH') || p.includes('CHAIN_BROKEN')));
});
