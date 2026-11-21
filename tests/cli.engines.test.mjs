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
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-engines-'));
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

test('requirements add, list, show, update, delete and coverage', { timeout: 60000 }, async () => {
  const root = await project();

  const add = await run([
    'requirements', 'add', '--target', root, '--type', 'FUNCTIONAL',
    '--title', 'User can export invoices', '--priority', 'must',
    '--ac', 'PDF generated with correct totals', '--json',
  ]);
  assert.equal(add.code, 0, add.stderr);
  const created = parseJson(add);
  assert.equal(created.id, 'REQ-F-001');
  assert.equal(created.status, 'DRAFT');

  const list = await run(['requirements', 'list', '--target', root, '--json']);
  assert.equal(list.code, 0, list.stderr);
  assert.equal(parseJson(list).count, 1);

  const show = await run(['requirements', 'show', 'REQ-F-001', '--target', root, '--json']);
  assert.equal(show.code, 0, show.stderr);
  assert.equal(parseJson(show).title, 'User can export invoices');

  const update = await run(['requirements', 'update', 'REQ-F-001', '--target', root, '--status', 'VALIDATED', '--json']);
  assert.equal(update.code, 0, update.stderr);
  assert.equal(parseJson(update).status, 'VALIDATED');

  const coverage = await run(['requirements', 'coverage', '--target', root, '--json']);
  assert.equal(coverage.code, 0, coverage.stderr);
  const cov = parseJson(coverage);
  assert.equal(cov.coverage.total, 1);
  assert.equal(cov.coverage.covered, 0);
  assert.equal(cov.details[0].covered, false);

  const del = await run(['requirements', 'delete', 'REQ-F-001', '--target', root]);
  assert.equal(del.code, 0, del.stderr);
  const after = await run(['requirements', 'show', 'REQ-F-001', '--target', root, '--json']);
  assert.equal(parseJson(after).status, 'BLOCKED');

  const badType = await run(['requirements', 'add', '--target', root, '--type', 'BOGUS', '--title', 'x']);
  assert.equal(badType.code, 1);
});

test('artefacts list, validate and verify on real artefact files', { timeout: 60000 }, async () => {
  const root = await project();
  const artefactsDir = path.join(root, '.aidf', 'artefacts');
  await fsp.mkdir(artefactsDir, { recursive: true });

  const now = new Date().toISOString();
  const artefact = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
    status: 'DRAFT',
    type: 'requirement',
    title: 'Traced requirement',
    source: { type: 'human', author: 'test', createdAt: now },
    links: { implementedBy: ['BACKEND-001'] },
    validation: { schemaVersion: '1.0.0', timestamp: now, valid: true, errors: [], warnings: [] },
  };
  const impl = {
    ...artefact,
    id: 'BACKEND-001',
    type: 'implementation',
    title: 'Implementation',
    links: {},
  };
  await fsp.writeFile(path.join(artefactsDir, 'req.json'), JSON.stringify(artefact));
  await fsp.writeFile(path.join(artefactsDir, 'impl.json'), JSON.stringify(impl));

  const list = await run(['artefacts', 'list', '--target', root, '--json']);
  assert.equal(list.code, 0, list.stderr);
  assert.equal(parseJson(list).count, 2);

  const validate = await run(['artefacts', 'validate', '--target', root, '--all', '--json']);
  assert.equal(validate.code, 0, validate.stderr);
  assert.equal(parseJson(validate).valid, 2);

  const verify = await run(['artefacts', 'verify', 'REQ-F-001', '--target', root, '--json']);
  assert.equal(verify.code, 0, verify.stderr);
  const chain = parseJson(verify);
  assert.equal(chain.ok, true);
  assert.ok(chain.path.includes('BACKEND-001'));

  const show = await run(['artefacts', 'show', 'REQ-F-001', '--target', root, '--json']);
  assert.equal(parseJson(show).id, 'REQ-F-001');

  const missing = await run(['artefacts', 'show', 'NOPE', '--target', root]);
  assert.equal(missing.code, 1);
});

test('traceability report, missing and broken on seeded artefacts', { timeout: 60000 }, async () => {
  const root = await project();
  const artefactsDir = path.join(root, '.aidf', 'artefacts');
  await fsp.mkdir(artefactsDir, { recursive: true });

  const now = new Date().toISOString();
  const base = {
    schemaVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
    status: 'DRAFT',
    source: { type: 'human', author: 'test', createdAt: now },
    links: {},
    validation: { schemaVersion: '1.0.0', timestamp: now, valid: true, errors: [], warnings: [] },
  };
  await fsp.writeFile(path.join(artefactsDir, 'req.json'), JSON.stringify({
    ...base, id: 'REQ-F-001', type: 'requirement', title: 'r',
    links: { implementedBy: ['GHOST-1'] },
  }));
  await fsp.writeFile(path.join(artefactsDir, 'other.json'), JSON.stringify({
    ...base, id: 'OTHER-1', type: 'design', title: 'd',
  }));

  const report = await run(['traceability', 'report', '--target', root, '--json']);
  assert.equal(report.code, 1, 'broken link must fail the report');
  const rep = parseJson(report);
  assert.equal(rep.broken.length, 1);
  assert.equal(rep.broken[0].targetId, 'GHOST-1');

  const missing = await run(['traceability', 'missing', '--target', root, '--type', 'test', '--json']);
  assert.equal(missing.code, 1);
  const miss = parseJson(missing);
  assert.equal(miss.count, 2);

  const broken = await run(['traceability', 'broken', '--target', root, '--json']);
  assert.equal(broken.code, 1);
  assert.equal(parseJson(broken).count, 1);

  const verify = await run(['traceability', 'verify', 'REQ-F-001', '--target', root, '--json']);
  assert.equal(verify.code, 1);
  assert.equal(parseJson(verify).ok, false);
});

test('decision evaluate writes a validated artefact under decisions/', { timeout: 60000 }, async () => {
  const root = await project();
  const ctxFile = path.join(root, 'ctx.json');
  const optFile = path.join(root, 'opts.json');
  await fsp.writeFile(ctxFile, JSON.stringify({
    projectType: 'web app',
    skills: ['node', 'react'],
    budget: { max: 50000, currency: 'USD' },
    platform: ['web'],
    license: ['MIT'],
  }));
  await fsp.writeFile(optFile, JSON.stringify({
    technologyOptions: [
      {
        id: 'nextjs',
        platform: ['web'],
        license: 'MIT',
        costs: { estimatedCost: 0 },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        maintenance: { complexity: 'moderate', skillRequirements: ['react'] },
        scalability: { horizontal: true, vertical: true },
      },
      {
        id: 'rails',
        platform: ['web'],
        license: 'MIT',
        costs: { estimatedCost: 100 },
        ecosystem: { documentationQuality: 'good', communitySize: 'large' },
        maintenance: { complexity: 'simple', skillRequirements: [] },
        scalability: { vertical: true },
      },
    ],
  }));

  const dry = await run(['decision', 'evaluate', '--target', root, '--context', 'ctx.json', '--options', 'opts.json', '--json']);
  assert.equal(dry.code, 0, dry.stderr);
  const dryJson = parseJson(dry);
  assert.ok(dryJson.document.recommendation);
  assert.equal(dryJson.artefact, null);
  assert.equal(await fsp.stat(path.join(root, '.aidf', 'artefacts', 'decisions')).then(() => true).catch(() => false), false);

  const write = await run(['decision', 'evaluate', '--target', root, '--context', 'ctx.json', '--options', 'opts.json', '--write', '--json']);
  assert.equal(write.code, 0, write.stderr);
  const written = parseJson(write);
  assert.ok(written.artefact);
  const artefact = JSON.parse(await fsp.readFile(written.artefact, 'utf8'));
  assert.equal(artefact.type, 'decision');
  assert.equal(artefact.status, 'DRAFT');
  assert.equal(artefact.document.humanApproval.required, true);

  const md = await run(['decision', 'evaluate', '--target', root, '--context', 'ctx.json', '--options', 'opts.json', '--out', 'decision.md', '--markdown']);
  assert.equal(md.code, 0, md.stderr);
  const mdText = await fsp.readFile(path.join(root, 'decision.md'), 'utf8');
  assert.ok(mdText.includes('# TECH-DECISION-'));

  const bad = await run(['decision', 'evaluate', '--target', root, '--context', 'missing.json', '--options', 'opts.json']);
  assert.equal(bad.code, 1);
});

test('design classify and run produce real fallback outputs', { timeout: 60000 }, async () => {
  const root = await project();
  const ctxFile = path.join(root, 'design-ctx.json');
  await fsp.writeFile(ctxFile, JSON.stringify({
    featureCount: 3,
    teamSize: 1,
    timelineWeeks: 1,
    budget: 1000,
    screens: [{
      name: 'Home',
      width: 375,
      height: 667,
      elements: [
        { type: 'text', x: 10, y: 10, content: 'Hello' },
        { type: 'button', x: 10, y: 40, width: 120, height: 40, label: 'Go' },
      ],
    }],
    theme: { primary: '#3366ff' },
  }));

  const classify = await run(['design', 'classify', '--target', root, '--context', 'design-ctx.json', '--json']);
  assert.equal(classify.code, 0, classify.stderr);
  const cls = parseJson(classify);
  assert.equal(cls.complexity.complexity, 'small');
  assert.equal(cls.workflow, 'quick');

  const runRes = await run(['design', 'run', '--target', root, '--context', 'design-ctx.json', '--write', '--json']);
  assert.equal(runRes.code, 0, runRes.stderr);
  const result = parseJson(runRes);
  assert.equal(result.status, 'fallback');
  assert.ok(result.written);
  assert.ok(result.written.files.some((f) => f.endsWith('home.svg')));
  assert.ok(result.written.files.some((f) => f.endsWith('FALLBACK.md')));

  const svgText = await fsp.readFile(path.join(result.written.dir, 'home.svg'), 'utf8');
  assert.ok(svgText.includes('<svg'));
  assert.ok(svgText.includes('Hello'));

  const dry = await run(['design', 'run', '--target', root, '--context', 'design-ctx.json']);
  assert.equal(dry.code, 0, dry.stderr);
});
