import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { Installer, summarizeResults } from '../src/core/installer.mjs';
import { emptyManifest } from '../src/core/manifest.mjs';
import { readText, exists, sha256File } from '../src/util/fsx.mjs';

async function tempProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-installer-'));
  return root;
}

function makeInstaller(root, options = {}) {
  return new Installer({
    root,
    manifest: options.manifest ?? emptyManifest(),
    dryRun: options.dryRun,
    force: options.force,
  });
}

test('creates a file, records its hash, and is idempotent', async () => {
  const root = await tempProject();
  const installer = makeInstaller(root);
  const [first] = await installer.apply([{ kind: 'write', path: '.aidf/docs/PRD.md', content: 'hello\n' }]);
  assert.equal(first.status, 'CREATED');
  assert.equal(await readText(path.join(root, '.aidf/docs/PRD.md')), 'hello\n');
  const record = installer.manifest.files['.aidf/docs/PRD.md'];
  assert.equal(record.sha256, await sha256File(path.join(root, '.aidf/docs/PRD.md')));

  const second = await makeInstaller(root, { manifest: installer.manifest }).apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'hello\n' },
  ]);
  assert.equal(second[0].status, 'UNCHANGED');
});

test('never overwrites an unmanaged file', async () => {
  const root = await tempProject();
  await fsp.mkdir(path.join(root, '.aidf/docs'), { recursive: true });
  await fsp.writeFile(path.join(root, '.aidf/docs/PRD.md'), 'project content\n', 'utf8');
  const installer = makeInstaller(root);
  const [result] = await installer.apply([{ kind: 'write', path: '.aidf/docs/PRD.md', content: 'aidf\n' }]);
  assert.equal(result.status, 'CONFLICT');
  assert.equal(await readText(path.join(root, '.aidf/docs/PRD.md')), 'project content\n');
});

test('detects local edits to managed files and preserves them', async () => {
  const root = await tempProject();
  const installer = makeInstaller(root);
  await installer.apply([{ kind: 'write', path: '.aidf/docs/PRD.md', content: 'original\n' }]);
  await fsp.writeFile(path.join(root, '.aidf/docs/PRD.md'), 'edited by human\n', 'utf8');
  const [result] = await makeInstaller(root, { manifest: installer.manifest }).apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'new\n' },
  ]);
  assert.equal(result.status, 'CONFLICT');
  assert.equal(await readText(path.join(root, '.aidf/docs/PRD.md')), 'edited by human\n');
});

test('--force backs up and overwrites a managed file', async () => {
  const root = await tempProject();
  const installer = makeInstaller(root);
  await installer.apply([{ kind: 'write', path: '.aidf/docs/PRD.md', content: 'original\n' }]);
  await fsp.writeFile(path.join(root, '.aidf/docs/PRD.md'), 'edited\n', 'utf8');
  const [result] = await makeInstaller(root, { manifest: installer.manifest, force: true }).apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'forced\n' },
  ]);
  assert.equal(result.status, 'UPDATED');
  assert.equal(await readText(path.join(root, '.aidf/docs/PRD.md')), 'forced\n');
});

test('dry-run writes nothing but reports the plan', async () => {
  const root = await tempProject();
  const installer = makeInstaller(root, { dryRun: true });
  const results = await installer.apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'x' },
    { kind: 'mkdir', path: '.aidf/evidence' },
  ]);
  assert.deepEqual(results.map((r) => r.status), ['WOULD_CREATE', 'WOULD_CREATE']);
  assert.equal(await exists(path.join(root, '.aidf/docs/PRD.md')), false);
  assert.equal(await exists(path.join(root, '.aidf/evidence')), false);
});

test('mkdir is idempotent', async () => {
  const root = await tempProject();
  const installer = makeInstaller(root);
  const [first] = await installer.apply([{ kind: 'mkdir', path: '.aidf/evidence' }]);
  const [second] = await installer.apply([{ kind: 'mkdir', path: '.aidf/evidence' }]);
  assert.equal(first.status, 'CREATED');
  assert.equal(second.status, 'UNCHANGED');
});

test('managed block preserves existing AGENTS.md content', async () => {
  const root = await tempProject();
  await fsp.writeFile(path.join(root, 'AGENTS.md'), '# Project\n\nKeep this.\n', 'utf8');
  const installer = makeInstaller(root);
  const [result] = await installer.apply([{ kind: 'managed-block', path: 'AGENTS.md', content: 'AIDF rules' }]);
  assert.equal(result.status, 'UPDATED');
  const text = await readText(path.join(root, 'AGENTS.md'));
  assert.ok(text.includes('Keep this.'));
  assert.ok(text.includes('AIDF rules'));
});

test('merge-json keeps existing keys and arrays', async () => {
  const root = await tempProject();
  await fsp.mkdir(path.join(root, '.qoder'), { recursive: true });
  await fsp.writeFile(
    path.join(root, '.qoder/settings.json'),
    JSON.stringify({ theme: 'dark', hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'existing' }] }] } }, null, 2),
    'utf8',
  );
  const installer = makeInstaller(root);
  const [result] = await installer.apply([{
    kind: 'merge-json',
    path: '.qoder/settings.json',
    patch: { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'aidf' }] }] } },
  }]);
  assert.equal(result.status, 'UPDATED');
  const merged = JSON.parse(await readText(path.join(root, '.qoder/settings.json')));
  assert.equal(merged.theme, 'dark');
  assert.equal(merged.hooks.SessionStart.length, 2);
  const commands = merged.hooks.SessionStart.flatMap((group) => group.hooks.map((hook) => hook.command));
  assert.ok(commands.includes('existing'));
  assert.ok(commands.includes('aidf'));
});

test('summary normalizes action statuses', () => {
  const summary = summarizeResults([
    { status: 'CREATED' },
    { status: 'UPDATED' },
    { status: 'UNCHANGED' },
    { status: 'CONFLICT' },
    { status: 'FAILED' },
    { status: 'WOULD_CREATE' },
  ]);
  assert.deepEqual(summary, {
    created: 1, updated: 1, unchanged: 1, conflicts: 1, failed: 1, linked: 0, would: 1,
  });
});

test('frozen actions are never overwritten, even with --force', async () => {
  const root = await tempProject();
  const manifest = emptyManifest();
  const installer = makeInstaller(root, { manifest });
  const [first] = await installer.apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'template\n', category: 'documents', frozen: true },
  ]);

  // L'utilisateur remplit le document : le contenu diverge du template.
  await fsp.writeFile(path.join(root, '.aidf/docs/PRD.md'), 'PRD rempli par le projet\n', 'utf8');

  const again = makeInstaller(root, { manifest });
  const [kept] = await again.apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'template v2 modifie\n', category: 'documents', frozen: true },
  ]);
  assert.equal(kept.status, 'UNCHANGED');
  assert.equal(await readText(path.join(root, '.aidf/docs/PRD.md')), 'PRD rempli par le projet\n');

  const forced = makeInstaller(root, { manifest, force: true });
  const [stillKept] = await forced.apply([
    { kind: 'write', path: '.aidf/docs/PRD.md', content: 'template v3\n', category: 'documents', frozen: true },
  ]);
  assert.equal(stillKept.status, 'UNCHANGED');
  assert.equal(await readText(path.join(root, '.aidf/docs/PRD.md')), 'PRD rempli par le projet\n');

  let created = first.status;
  assert.equal(created, 'CREATED');
});
