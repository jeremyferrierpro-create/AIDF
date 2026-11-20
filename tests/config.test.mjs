import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import {
  defaultConfig, validateConfig, setDocumentStatus, saveConfig, loadConfig, CONFIG_SCHEMA_VERSION,
} from '../src/core/config.mjs';
import { DOCUMENTS } from '../src/core/paths.mjs';

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-config-'));
}

test('defaultConfig declares every document and safe security defaults', () => {
  const config = defaultConfig({ name: 'demo' });
  assert.equal(config.schemaVersion, CONFIG_SCHEMA_VERSION);
  assert.equal(config.project.name, 'demo');
  assert.deepEqual(Object.keys(config.documents).sort(), [...DOCUMENTS].sort());
  for (const doc of DOCUMENTS) assert.equal(config.documents[doc].status, 'DRAFT');
  assert.equal(config.security.allowCommandExecution, false);
  assert.equal(config.security.allowNetwork, false);
  assert.equal(config.security.requireAuthenticatedApproval, false);
});

test('validateConfig accepts a default config and reports real inconsistencies', () => {
  const config = defaultConfig();
  assert.deepEqual(validateConfig(config), []);

  const badSchema = { ...config, schemaVersion: 99 };
  assert.ok(validateConfig(badSchema).some((e) => /schemaVersion/.test(e)));

  const missingDoc = structuredClone(config);
  delete missingDoc.documents.PRD;
  assert.ok(validateConfig(missingDoc).some((e) => /PRD/.test(e)));

  const badStatus = structuredClone(config);
  badStatus.documents.PRD.status = 'DONE';
  assert.ok(validateConfig(badStatus).some((e) => /invalid status for PRD/.test(e)));

  const badCommands = structuredClone(config);
  badCommands.security.allowedCommands = 'test';
  assert.ok(validateConfig(badCommands).some((e) => /allowedCommands/.test(e)));

  const badApprovalFlag = structuredClone(config);
  badApprovalFlag.security.requireAuthenticatedApproval = 'yes';
  assert.ok(validateConfig(badApprovalFlag).some((e) => /requireAuthenticatedApproval/.test(e)));
});

test('validateConfig stays backward compatible when the new flag is absent', () => {
  const config = defaultConfig();
  delete config.security.requireAuthenticatedApproval;
  assert.deepEqual(validateConfig(config), []);
});

test('setDocumentStatus records accountability and refuses unknown values', () => {
  const config = defaultConfig();
  const entry = setDocumentStatus(config, 'PRD', 'VALIDATED', { by: 'Jeremy', note: 'reviewed' });
  assert.equal(entry.status, 'VALIDATED');
  assert.equal(entry.validatedBy, 'Jeremy');
  assert.ok(entry.validatedAt);
  assert.equal(entry.note, 'reviewed');

  assert.throws(() => setDocumentStatus(config, 'NOPE', 'VALIDATED'), /Unknown document/);
  assert.throws(() => setDocumentStatus(config, 'PRD', 'DONE'), /Invalid document status/);
});

test('config round-trips through disk', async () => {
  const root = await tempRoot();
  const config = defaultConfig({ name: 'roundtrip' });
  await saveConfig(root, config);
  const loaded = await loadConfig(root);
  assert.equal(loaded.project.name, 'roundtrip');
  assert.equal(loaded.updatedAt.length > 0, true);
});
