import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, dumpYaml } from '../src/util/yaml.mjs';

test('parses nested maps, sequences, inline arrays and block scalars', () => {
  const source = `schemaVersion: 1
name: "quoted: value"
enabled: true
nothing: null
list: [a, b, 3]
nested:
  child:
    - id: one
      value: 1
    - id: two
      value: 2
text: |
  line one
  line two
folded: >
  a
  b
`;
  const parsed = parseYaml(source);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.name, 'quoted: value');
  assert.equal(parsed.enabled, true);
  assert.equal(parsed.nothing, null);
  assert.deepEqual(parsed.list, ['a', 'b', 3]);
  assert.deepEqual(parsed.nested.child, [
    { id: 'one', value: 1 },
    { id: 'two', value: 2 },
  ]);
  assert.equal(parsed.text, 'line one\nline two\n');
  assert.equal(parsed.folded, 'a b\n');
});

test('ignores comments and inline comments outside quotes', () => {
  const parsed = parseYaml(`# header
value: hello # trailing
quoted: "keep # this"
url: https://example.test/a#fragment
`);
  assert.equal(parsed.value, 'hello');
  assert.equal(parsed.quoted, 'keep # this');
  assert.equal(parsed.url, 'https://example.test/a#fragment');
});

test('dumps and re-parses a representative registry', () => {
  const value = {
    schemaVersion: 1,
    skills: [
      { id: 'a', name: 'aidf-a', deps: [], meta: { x: 1 } },
      { id: 'b', name: 'aidf-b', deps: ['a'] },
    ],
    nested: [[1, 2], [3]],
    text: 'line one\nline two',
  };
  const rendered = dumpYaml(value);
  assert.deepEqual(parseYaml(rendered), value);
});

test('rejects malformed input instead of guessing', () => {
  assert.throws(() => parseYaml('a: 1\n  b: 2\n'), /Unexpected indentation/);
  assert.throws(() => parseYaml('a: 1\nb\n'), /Expected "key: value"/);
});

test('parses the real gate and skill registries', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '..');
  const gates = parseYaml(await fs.readFile(path.join(root, 'assets', 'workflows', 'gates.yaml'), 'utf8'));
  const skills = parseYaml(await fs.readFile(path.join(root, 'assets', 'registry', 'skills.yaml'), 'utf8'));
  assert.equal(gates.gates.length, 16);
  assert.equal(skills.skills.length, 13);
  assert.ok(gates.gates.every((g) => g.id && Array.isArray(g.checks)));
  assert.ok(skills.skills.every((s) => s.id && s.name.startsWith('aidf-')));
});
