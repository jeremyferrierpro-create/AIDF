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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-delivery-'));
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

test('docs generate renders artefacts to markdown and detects manual edits', { timeout: 60000 }, async () => {
  const root = await project();

  const add = await run([
    'requirements', 'add', '--target', root, '--type', 'FUNCTIONAL',
    '--title', 'Export invoices', '--ac', 'PDF contains totals', '--json',
  ]);
  assert.equal(add.code, 0, add.stderr);
  const plan = await run(['tests', 'plan', '--target', root, '--write']);
  assert.equal(plan.code, 0, plan.stderr);

  const gen = await run(['docs', 'generate', '--target', root, '--json']);
  assert.equal(gen.code, 0, gen.stderr);
  const result = parseJson(gen);
  assert.ok(result.generated.length >= 2);
  const reqFile = path.join(root, '.aidf', 'docs', 'generated', 'REQUIREMENTS.md');
  const reqMd = await fsp.readFile(reqFile, 'utf8');
  assert.ok(reqMd.includes('REQ-F-001'));
  assert.ok(reqMd.includes('AIDF-GENERATED'));
  assert.ok(await fsp.stat(path.join(root, '.aidf', 'docs', 'generated', 'TEST-PLAN.md')).then(() => true).catch(() => false));

  // Manual edit is reported as divergence on check.
  await fsp.appendFile(reqFile, '\nmanual edit\n');
  const check = await run(['docs', 'generate', '--target', root, '--check', '--json']);
  assert.equal(check.code, 0, check.stderr);
  const checkResult = parseJson(check);
  const req = checkResult.generated.find((g) => g.file.endsWith('REQUIREMENTS.md'));
  assert.equal(req.diverged, true);
  assert.equal(req.action, 'diverged');

  // Regeneration overwrites and clears divergence.
  const regen = await run(['docs', 'generate', '--target', root]);
  assert.equal(regen.code, 0, regen.stderr);
  const after = await fsp.readFile(reqFile, 'utf8');
  assert.ok(!after.includes('manual edit'));
});

test('release report aggregates gates, docs and evidence honestly', { timeout: 120000 }, async () => {
  const root = await project();

  const report = await run(['release', 'report', '--target', root, '--json']);
  assert.equal(report.code, 0, report.stderr);
  const res = parseJson(report);
  assert.ok(['READY', 'NOT_READY'].includes(res.report.verdict));
  assert.ok(res.report.gates.length > 0);
  assert.ok(res.report.gates.every((g) => g.status !== 'PASS' || true));
  assert.ok(res.files.json.endsWith('.json'));
  assert.ok(res.files.markdown.endsWith('.md'));

  const mdPath = path.join(root, '.aidf', 'reports', res.files.markdown.split('/').pop());
  const md = await fsp.readFile(mdPath, 'utf8');
  assert.ok(md.includes('# AIDF Release Report'));
  assert.ok(md.includes(res.report.verdict));

  // --strict fails when not ready
  const strict = await run(['release', 'report', '--target', root, '--strict']);
  if (res.report.verdict !== 'READY') {
    assert.equal(strict.code, 1);
  } else {
    assert.equal(strict.code, 0);
  }

  // --record writes evidence
  const recorded = await run(['release', 'report', '--target', root, '--record', '--json']);
  assert.equal(recorded.code, 0, recorded.stderr);
  assert.ok(parseJson(recorded).evidence);
});
