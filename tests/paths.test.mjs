import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveInside, PathSafetyError, deepMerge, relativeTo } from '../src/util/fsx.mjs';
import {
  replaceManagedBlock, removeManagedBlock, hasManagedBlock, slugify, truncate,
} from '../src/util/text.mjs';

const root = path.resolve('C:/tmp/aidf-root');

test('accepts project-relative paths', () => {
  assert.equal(resolveInside(root, '.aidf/docs/PRD.md'), path.resolve(root, '.aidf/docs/PRD.md'));
  assert.equal(resolveInside(root, 'AGENTS.md'), path.resolve(root, 'AGENTS.md'));
});

test('rejects traversal, absolute paths and reserved names', () => {
  for (const candidate of ['../outside', '.aidf/../../outside', 'C:/Windows/system32', '/etc/passwd', 'con', '.aidf/CON.txt', 'a\0b', 'a<b']) {
    assert.throws(() => resolveInside(root, candidate), PathSafetyError, candidate);
  }
});

test('managed block replaces only its own region', () => {
  const initial = '# Project rules\n\nKeep me.\n';
  const withBlock = replaceManagedBlock(initial, 'AIDF content');
  assert.ok(hasManagedBlock(withBlock));
  assert.ok(withBlock.includes('Keep me.'));
  assert.ok(withBlock.includes('AIDF content'));
  const updated = replaceManagedBlock(withBlock, 'New content');
  assert.ok(updated.includes('New content'));
  assert.ok(!updated.includes('AIDF content'));
  assert.equal(updated.match(/AIDF:BEGIN/g).length, 1);
});

test('removing the block restores user content', () => {
  const initial = '# Project rules\n\nKeep me.\n';
  const withBlock = replaceManagedBlock(initial, 'AIDF content');
  const restored = removeManagedBlock(withBlock);
  assert.equal(restored.trim(), initial.trim());
  assert.equal(removeManagedBlock('no block here'), 'no block here');
});

test('malformed managed block is refused', () => {
  assert.throws(() => replaceManagedBlock('<!-- AIDF:BEGIN managed by aidf - do not edit inside this block -->\ncontent', 'x'), /Malformed/);
});

test('slugify and truncate are deterministic', () => {
  assert.equal(slugify('École Projet / 2026'), 'ecole-projet-2026');
  assert.equal(slugify('---'), 'project');
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('abc', 4), 'abc');
});

test('deepMerge does not overwrite existing scalars by default', () => {
  const base = { a: 1, nested: { keep: true }, list: [1] };
  const patch = { a: 2, nested: { added: true }, list: [2] };
  assert.deepEqual(deepMerge(base, patch), {
    a: 1,
    nested: { keep: true, added: true },
    list: [2],
  });
  assert.equal(deepMerge(base, patch, true).a, 2);
});

test('relativeTo uses posix separators', () => {
  assert.equal(relativeTo('C:/tmp/root', 'C:/tmp/root/.aidf/manifest.json'), '.aidf/manifest.json');
});
