import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { matchesGlobs, inspectResource } from '../src/core/resources.mjs';

async function resourceDir() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-resource-'));
  await fsp.mkdir(path.join(root, 'docs'), { recursive: true });
  await fsp.mkdir(path.join(root, 'node_modules'), { recursive: true });
  await fsp.writeFile(path.join(root, 'LICENSE'), 'MIT License\n', 'utf8');
  await fsp.writeFile(path.join(root, 'docs', 'a.md'), '# A\n', 'utf8');
  await fsp.writeFile(path.join(root, 'docs', 'b.txt'), 'B\n', 'utf8');
  await fsp.writeFile(path.join(root, 'node_modules', 'x.md'), '# X\n', 'utf8');
  await fsp.writeFile(path.join(root, '.env'), 'TOKEN=never-read\n', 'utf8');
  return root;
}

test('matchesGlobs applies include and exclude deterministically', () => {
  assert.equal(matchesGlobs('docs/a.md', ['**/*.md'], []), true);
  assert.equal(matchesGlobs('docs/a.txt', ['**/*.md'], []), false);
  assert.equal(matchesGlobs('STAGE/x.md', ['**/*.md'], ['STAGE/**']), false);
  assert.equal(matchesGlobs('node_modules/x.md', [], ['node_modules/**']), false);
  assert.equal(matchesGlobs('anything/at/all.txt', [], []), true);
});

test('inspectResource pins a licensed resource and excludes secrets', async () => {
  const dir = await resourceDir();
  const result = await inspectResource({
    id: 'demo', name: 'Demo', kind: 'clone', license: 'MIT', localPath: dir,
    include: ['**/*.md'], exclude: ['node_modules/**', '**/.env*'],
  });
  assert.equal(result.status, 'PRESENT');
  assert.equal(result.files, 1);
  assert.equal(result.licenseFile.file, 'LICENSE');
  assert.match(result.treeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(result.treeHash, '');
});

test('inspectResource blocks an unknown licence as index-only', async () => {
  const dir = await resourceDir();
  const result = await inspectResource({
    id: 'unknown', name: 'Unknown', kind: 'clone', license: 'unknown', localPath: dir,
    include: ['**/*.md'], exclude: ['node_modules/**'],
  });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.note, /index-only/);
});

test('inspectResource marks a known licence without licence file as PARTIAL', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-resource-nolicense-'));
  await fsp.writeFile(path.join(dir, 'a.md'), '# A\n', 'utf8');
  const result = await inspectResource({
    id: 'partial', name: 'Partial', kind: 'clone', license: 'MIT', localPath: dir,
    include: ['**/*.md'],
  });
  assert.equal(result.status, 'PARTIAL');
});

test('inspectResource reports ABSENT and reference-only resources honestly', async () => {
  const absent = await inspectResource({
    id: 'absent', name: 'Absent', kind: 'clone', license: 'MIT',
    localPath: path.join(os.tmpdir(), 'aidf-does-not-exist-xyz'),
  });
  assert.equal(absent.status, 'ABSENT');
  assert.equal(absent.path, null);

  const reference = await inspectResource({ id: 'ref', name: 'Ref', kind: 'reference', license: 'CC-BY-4.0', status: 'AVAILABLE' });
  assert.equal(reference.status, 'AVAILABLE');
  assert.equal(reference.path, null);
  assert.match(reference.note, /Reference-only/);
});
