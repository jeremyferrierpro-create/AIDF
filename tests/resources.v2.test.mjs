import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import {
  licensePolicy, normalizeLicense, isSecretPath, inventoryResource, inventoryAll,
  summarizeInventory, coverageReport, reconcile, writeInventory, readInventory,
} from '../src/core/resource-inventory.mjs';

async function fixtureRoot() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-inv-'));
  await fsp.mkdir(path.join(root, 'res', 'skills', 'demo'), { recursive: true });
  await fsp.writeFile(path.join(root, 'res', 'README.md'), '# Demo\n');
  await fsp.writeFile(
    path.join(root, 'res', 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: A demo skill for inventory tests.\n---\n\nUse this skill when testing.\n',
  );
  await fsp.writeFile(path.join(root, 'res', '.env'), 'SECRET=do-not-read\n');
  await fsp.writeFile(path.join(root, 'res', 'cert.pem'), 'secret\n');
  return root;
}

test('licence policy normalises names and blocks unknown or GPL', () => {
  assert.equal(normalizeLicense('MIT'), 'MIT');
  assert.equal(normalizeLicense('mit license'), 'MIT');
  assert.equal(normalizeLicense('Licence Ouverte 2.0'), 'Licence Ouverte 2.0');
  assert.equal(normalizeLicense(undefined), 'unknown');
  assert.equal(licensePolicy('MIT').copy, true);
  assert.equal(licensePolicy('unknown').redistribution, 'blocked');
  assert.equal(licensePolicy('GPL-2.0').copy, false);
});

test('secret-like paths are detected without opening them', () => {
  assert.ok(isSecretPath('.env'));
  assert.ok(isSecretPath('config/.env.local'));
  assert.ok(isSecretPath('keys/server.pem'));
  assert.ok(isSecretPath('secrets.yaml'));
  assert.ok(!isSecretPath('README.md'));
});

test('inventory hashes every included file and never lists secrets', async () => {
  const root = await fixtureRoot();
  const resource = {
    id: 'fixture',
    name: 'Fixture',
    kind: 'git',
    license: 'MIT',
    localPath: 'res',
    include: ['**/*'],
    exclude: ['.git/**'],
  };
  const result = await inventoryResource(resource, { roots: [root] });
  assert.equal(result.status, 'PRESENT');
  assert.equal(result.fileCount, 2);
  assert.equal(result.files.length, 2);
  assert.ok(result.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256)));
  assert.ok(!result.files.some((f) => f.path === '.env'));
  assert.ok(!result.files.some((f) => f.path === 'cert.pem'));
  assert.equal(result.skipped.secrets, 2);
  assert.equal(result.skills.length, 1);
  assert.equal(result.skills[0].name, 'demo');
  assert.equal(result.skills[0].valid, true);

  const again = await inventoryResource(resource, { roots: [root] });
  assert.equal(again.treeHash, result.treeHash);
});

test('inventory marks unknown-licence resources as blocked but still indexes them', async () => {
  const root = await fixtureRoot();
  const result = await inventoryResource({
    id: 'unknown', name: 'Unknown', kind: 'git', license: undefined, localPath: 'res',
  }, { roots: [root] });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.license, 'unknown');
  assert.equal(result.fileCount, 2);
});

test('coverage reports missing resources and duplicate skills', () => {
  const sources = { resources: [{ id: 'a' }, { id: 'b' }, { id: 'missing' }] };
  const results = [
    { id: 'a', status: 'PRESENT', license: 'MIT', skills: [{ name: 'x', path: 'x/SKILL.md', sha256: '1', valid: true }] },
    { id: 'b', status: 'PRESENT', license: 'MIT', skills: [{ name: 'x', path: 'b/x/SKILL.md', sha256: '1', valid: true }] },
  ];
  const coverage = coverageReport(sources, results);
  assert.equal(coverage.declaredResources, 3);
  assert.equal(coverage.inventoriedResources, 2);
  assert.deepEqual(coverage.missing, ['missing']);
  assert.equal(coverage.complete, false);
  assert.equal(coverage.uniqueSkills, 1);
  assert.equal(coverage.duplicateSkills[0].identical, true);
});

test('reconcile reports changed and missing tree hashes', () => {
  const lock = { resources: { a: { treeHash: 'aaa' }, b: { treeHash: 'bbb' }, c: { treeHash: 'ccc' } } };
  const manifest = { resources: [{ id: 'a', treeHash: 'aaa' }, { id: 'b', treeHash: 'zzz' }] };
  const report = reconcile(lock, manifest);
  assert.deepEqual(report.unchanged, ['a']);
  assert.deepEqual(report.drift.map((d) => [d.id, d.kind]), [['b', 'CHANGED'], ['c', 'MISSING']]);
});

test('inventoryAll persists a manifest and summarises totals', async () => {
  const root = await fixtureRoot();
  const sources = {
    resources: [
      { id: 'fixture', name: 'Fixture', kind: 'git', license: 'MIT', localPath: 'res' },
      { id: 'ref', name: 'Ref', kind: 'reference', license: 'MIT' },
    ],
  };
  const results = await inventoryAll(sources, { roots: [root] });
  const summary = summarizeInventory(results);
  assert.equal(summary.resources, 2);
  assert.equal(summary.files, 2);
  assert.equal(summary.skills, 1);
  const project = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-inv-proj-'));
  const written = await writeInventory(project, results);
  assert.ok(written.file.endsWith('resources.manifest.json'));
  const read = await readInventory(project);
  assert.equal(read.resources.length, 2);
});
