import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import {
  recordEvidence, verifyEvidenceChain, verifyEvidenceFile, loadEvidenceIndex, saveEvidenceIndex,
} from '../src/core/evidence.mjs';
import { ensureDir, readJson, writeJson, readText } from '../src/util/fsx.mjs';

async function tempRoot() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-evidence-'));
  await ensureDir(path.join(root, '.aidf', 'evidence'));
  return root;
}

async function twoRecords(root) {
  const first = await recordEvidence(root, { type: 'test-run', status: 'PASS', summary: 'first' });
  const second = await recordEvidence(root, { type: 'test-run', status: 'PASS', summary: 'second' });
  return { first, second };
}

test('a valid evidence chain verifies with previous links and index', async () => {
  const root = await tempRoot();
  const { first, second } = await twoRecords(root);
  assert.equal(first.previous, null);
  assert.equal(second.previous, first.hash);
  const index = await loadEvidenceIndex(root);
  assert.equal(index.lastHash, second.hash);
  const chain = await verifyEvidenceChain(root);
  assert.deepEqual(chain.problems, []);
  assert.equal(chain.ok, true);
  assert.equal(chain.checked, 2);
});

test('tampering a record is detected as a hash mismatch', async () => {
  const root = await tempRoot();
  const { second } = await twoRecords(root);
  const body = await readJson(path.join(root, second.file), null);
  body.summary = 'tampered';
  await writeJson(path.join(root, second.file), body);
  const chain = await verifyEvidenceChain(root);
  assert.equal(chain.ok, false);
  assert.ok(chain.problems.some((p) => p.code === 'HASH_MISMATCH'));
  assert.equal((await verifyEvidenceFile(root, { file: second.file })).ok, false);
});

test('a missing record file is detected', async () => {
  const root = await tempRoot();
  const { first } = await twoRecords(root);
  await fsp.rm(path.join(root, first.file));
  const chain = await verifyEvidenceChain(root);
  assert.equal(chain.ok, false);
  assert.ok(chain.problems.some((p) => p.code === 'MISSING_FILE'));
});

test('a broken previous link is detected', async () => {
  const root = await tempRoot();
  const { first, second } = await twoRecords(root);
  const body = await readJson(path.join(root, second.file), null);
  body.previous = first.hash;
  // Recompute the record hash so only the chain link is wrong.
  const { sha256Text } = await import('../src/util/fsx.mjs');
  const copy = { ...body };
  delete copy.hash;
  body.hash = sha256Text(JSON.stringify(copy));
  await writeJson(path.join(root, second.file), body);
  const index = await loadEvidenceIndex(root);
  const entry = index.entries.find((e) => e.id === second.id);
  entry.hash = body.hash;
  index.lastHash = body.hash;
  await saveEvidenceIndex(root, index);
  // Point the second record at a hash that is not its predecessor.
  const tampered = await readJson(path.join(root, second.file), null);
  tampered.previous = 'deadbeef';
  const copy2 = { ...tampered };
  delete copy2.hash;
  tampered.hash = sha256Text(JSON.stringify(copy2));
  await writeJson(path.join(root, second.file), tampered);
  index.entries.find((e) => e.id === second.id).hash = tampered.hash;
  index.lastHash = tampered.hash;
  await saveEvidenceIndex(root, index);
  const chain = await verifyEvidenceChain(root);
  assert.equal(chain.ok, false);
  assert.ok(chain.problems.some((p) => p.code === 'CHAIN_BROKEN'));
});

test('index inconsistencies are detected', async () => {
  const root = await tempRoot();
  const { second } = await twoRecords(root);
  const index = await loadEvidenceIndex(root);
  index.lastHash = 'not-the-last-hash';
  await saveEvidenceIndex(root, index);
  const chain = await verifyEvidenceChain(root);
  assert.ok(chain.problems.some((p) => p.code === 'INDEX_LAST_HASH_MISMATCH'));

  index.entries.push({ ...index.entries[0] });
  await saveEvidenceIndex(root, index);
  const duplicate = await verifyEvidenceChain(root);
  assert.ok(duplicate.problems.some((p) => p.code === 'DUPLICATE_ID'));

  const unindexed = path.join(root, '.aidf', 'evidence', 'orphan.json');
  await writeJson(unindexed, { id: 'orphan', hash: 'x' });
  const orphaned = await verifyEvidenceChain(root);
  assert.ok(orphaned.problems.some((p) => p.code === 'UNINDEXED_RECORD'));
  assert.ok(second.hash);
});

test('declared approvals are recorded as unauthenticated', async () => {
  const root = await tempRoot();
  const declared = await recordEvidence(root, {
    type: 'security-review', status: 'PASS', humanApproval: true, approvedBy: 'Jeremy', summary: 'declared',
  });
  assert.equal(declared.approval.authenticated, false);
  assert.equal(declared.approval.method, 'declared');
  assert.equal(declared.approval.declaredBy, 'Jeremy');
  assert.equal(declared.approvedBy, 'Jeremy');

  const index = await loadEvidenceIndex(root);
  assert.equal(index.entries[0].authenticatedApproval, false);
  assert.equal(index.entries[0].approvalMethod, 'declared');

  const agent = await recordEvidence(root, { type: 'test-run', status: 'PASS', summary: 'agent' });
  assert.equal(agent.approval.authenticated, false);
  assert.equal(agent.approval.method, 'none');
});

test('an empty evidence store verifies cleanly', async () => {
  const root = await tempRoot();
  const chain = await verifyEvidenceChain(root);
  assert.equal(chain.ok, true);
  assert.equal(chain.checked, 0);
  assert.deepEqual(chain.problems, []);
});

test('evidence files are readable text JSON (no hidden binary state)', async () => {
  const root = await tempRoot();
  const { first } = await twoRecords(root);
  const text = await readText(path.join(root, first.file));
  assert.match(text, /"schemaVersion": 1/);
  assert.match(text, /"hash": "[a-f0-9]{64}"/);
});
