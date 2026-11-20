import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readJson } from '../src/util/fsx.mjs';

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

async function installedProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-docs-'));
  await fsp.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'docs-demo', version: '1.0.0' }), 'utf8');
  const install = await run(['install', '--target', root, '--adapter', 'generic', '--json']);
  assert.equal(install.code, 0, install.stderr);
  return root;
}

test('docs status requires human accountability for VALIDATED', async () => {
  const root = await installedProject();
  const refused = await run(['docs', 'status', 'PRD', 'VALIDATED', '--target', root]);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /requires --by/);

  const accepted = await run(['docs', 'status', 'PRD', 'VALIDATED', '--by', 'Jeremy', '--note', 'reviewed', '--target', root]);
  assert.equal(accepted.code, 0, accepted.stderr);
  const file = await fsp.readFile(path.join(root, '.aidf', 'docs', 'PRD.md'), 'utf8');
  assert.match(file, /status: VALIDATED/);
  assert.match(file, /validated_by: Jeremy/);
  const config = await readJson(path.join(root, '.aidf', 'config.json'), null);
  assert.equal(config.documents.PRD.status, 'VALIDATED');
  assert.equal(config.documents.PRD.validatedBy, 'Jeremy');
});

test('docs status requires a note for NOT_APPLICABLE', async () => {
  const root = await installedProject();
  const refused = await run(['docs', 'status', 'UI-UX', 'NOT_APPLICABLE', '--target', root]);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /requires --note/);

  const accepted = await run(['docs', 'status', 'UI-UX', 'NOT_APPLICABLE', '--note', 'CLI-only product', '--target', root]);
  assert.equal(accepted.code, 0, accepted.stderr);
  const config = await readJson(path.join(root, '.aidf', 'config.json'), null);
  assert.equal(config.documents['UI-UX'].status, 'NOT_APPLICABLE');
  assert.equal(config.documents['UI-UX'].note, 'CLI-only product');
});

test('docs status refuses unknown documents and statuses', async () => {
  const root = await installedProject();
  const unknownDoc = await run(['docs', 'status', 'NOPE', 'VALIDATED', '--by', 'Jeremy', '--target', root]);
  assert.equal(unknownDoc.code, 1);
  const unknownStatus = await run(['docs', 'status', 'PRD', 'DONE', '--by', 'Jeremy', '--target', root]);
  assert.equal(unknownStatus.code, 1);
});
