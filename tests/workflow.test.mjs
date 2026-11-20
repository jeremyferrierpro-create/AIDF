import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { evaluateGate, runCommand, tokenizeCommand } from '../src/core/workflow.mjs';
import { recordEvidence } from '../src/core/evidence.mjs';
import { defaultConfig } from '../src/core/config.mjs';
import { ensureDir } from '../src/util/fsx.mjs';

async function tempProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-workflow-'));
  await ensureDir(path.join(root, '.aidf', 'evidence'));
  await ensureDir(path.join(root, '.aidf', 'docs'));
  return root;
}

function state(gates = {}) {
  return { schemaVersion: 1, currentPhase: 'intake', completed: false, gates, history: [] };
}

test('file-exists check reports PASS or NOT_PROVEN', async () => {
  const root = await tempProject();
  await fsp.writeFile(path.join(root, '.aidf/docs/constitution.md'), '# Constitution\n', 'utf8');
  const gate = {
    id: 'g', phase: 'intake', kind: 'entry',
    checks: [
      { id: 'present', type: 'file-exists', path: '.aidf/docs/constitution.md' },
      { id: 'missing', type: 'file-exists', path: '.aidf/docs/TRD.md' },
    ],
  };
  const report = await evaluateGate(root, gate, { config: defaultConfig(), state: state() });
  assert.equal(report.status, 'NOT_PROVEN');
  assert.equal(report.checks[0].status, 'PASS');
  assert.equal(report.checks[1].status, 'NOT_PROVEN');
});

test('doc-status enforces allowed and disallowed statuses', async () => {
  const root = await tempProject();
  const config = defaultConfig();
  config.documents.PRD.status = 'DRAFT';
  config.documents.SECURITY.status = 'BLOCKED';
  await fsp.writeFile(
    path.join(root, '.aidf/docs/PRD.md'),
    '---\ndoc: PRD\nstatus: DRAFT\n---\n\n# PRD\n',
    'utf8',
  );
  await fsp.writeFile(
    path.join(root, '.aidf/docs/SECURITY.md'),
    '---\ndoc: SECURITY\nstatus: BLOCKED\n---\n\n# Security\n',
    'utf8',
  );
  const gate = {
    id: 'g', phase: 'specification', kind: 'exit',
    checks: [
      { id: 'prd', type: 'doc-status', documents: ['PRD'], allowed: ['VALIDATED', 'NOT_APPLICABLE'] },
      { id: 'security', type: 'doc-status', documents: ['SECURITY'], disallowed: ['BLOCKED', 'OUTDATED'] },
    ],
  };
  const report = await evaluateGate(root, gate, { config, state: state() });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.checks[0].status, 'NOT_PROVEN');
  assert.equal(report.checks[1].status, 'FAIL');
});

test('doc-status cross-checks the document frontmatter against config', async () => {
  const root = await tempProject();
  const config = defaultConfig();
  config.documents.PRD.status = 'VALIDATED';
  await fsp.writeFile(
    path.join(root, '.aidf/docs/PRD.md'),
    '---\ndoc: PRD\nstatus: DRAFT\n---\n\n# PRD\n',
    'utf8',
  );
  const gate = {
    id: 'g', phase: 'specification', kind: 'exit',
    checks: [{ id: 'prd', type: 'doc-status', documents: ['PRD'], allowed: ['VALIDATED'] }],
  };
  const report = await evaluateGate(root, gate, { config, state: state() });
  assert.equal(report.status, 'FAIL');
  assert.match(report.checks[0].reason, /status mismatch: file=DRAFT config=VALIDATED/);
});

test('doc-status refuses a missing document file', async () => {
  const root = await tempProject();
  const config = defaultConfig();
  const gate = {
    id: 'g', phase: 'specification', kind: 'exit',
    checks: [{ id: 'prd', type: 'doc-status', documents: ['PRD'], allowed: ['VALIDATED'] }],
  };
  const report = await evaluateGate(root, gate, { config, state: state() });
  assert.equal(report.status, 'BLOCKED');
  assert.match(report.checks[0].reason, /file is missing/);
});

test('previous-gate blocks until prior gates are PASS', async () => {
  const root = await tempProject();
  const gate = {
    id: 'g', phase: 'discovery', kind: 'entry',
    checks: [{ id: 'prior', type: 'previous-gate', gates: ['intake-exit'] }],
  };
  const blocked = await evaluateGate(root, gate, { config: defaultConfig(), state: state() });
  assert.equal(blocked.status, 'NOT_PROVEN');
  const passed = await evaluateGate(root, gate, {
    config: defaultConfig(),
    state: state({ 'intake-exit': { status: 'PASS' } }),
  });
  assert.equal(passed.status, 'PASS');
});

test('command checks never run without explicit permission', async () => {
  const root = await tempProject();
  const config = defaultConfig();
  config.commands.test = 'node --version';
  const gate = {
    id: 'g', phase: 'testing', kind: 'exit',
    checks: [{ id: 'test', type: 'command', commandKey: 'test' }],
  };
  const report = await evaluateGate(root, gate, { config, state: state(), allowExec: false });
  assert.equal(report.status, 'NOT_PROVEN');
  assert.match(report.checks[0].reason, /--allow-exec/);
});

test('command checks run with permission and record output', async () => {
  const root = await tempProject();
  const config = defaultConfig();
  config.commands.test = 'node --version';
  const gate = {
    id: 'g', phase: 'testing', kind: 'exit',
    checks: [{ id: 'test', type: 'command', commandKey: 'test' }],
  };
  const report = await evaluateGate(root, gate, { config, state: state(), allowExec: true });
  assert.equal(report.status, 'PASS');
  assert.match(report.checks[0].command.stdout, /^v\d+/);
});

test('missing command is BLOCKED unless declared NOT_APPLICABLE', async () => {
  const root = await tempProject();
  const config = defaultConfig();
  const gate = {
    id: 'g', phase: 'release', kind: 'exit',
    checks: [
      { id: 'build', type: 'command', commandKey: 'build', blocking: false, missing: 'NOT_APPLICABLE' },
      { id: 'test', type: 'command', commandKey: 'test' },
    ],
  };
  const report = await evaluateGate(root, gate, { config, state: state(), allowExec: true });
  assert.equal(report.checks[0].status, 'NOT_APPLICABLE');
  assert.equal(report.checks[1].status, 'BLOCKED');
});

test('a blocking check cannot be NOT_APPLICABLE', async () => {
  const root = await tempProject();
  const gate = {
    id: 'g', phase: 'release', kind: 'exit',
    checks: [
      { id: 'build', type: 'command', commandKey: 'build', blocking: true, missing: 'NOT_APPLICABLE' },
    ],
  };
  const report = await evaluateGate(root, gate, { config: defaultConfig(), state: state(), allowExec: true });
  assert.equal(report.checks[0].status, 'BLOCKED');
  assert.equal(report.status, 'BLOCKED');
  assert.match(report.checks[0].reason, /blocking check cannot be NOT_APPLICABLE/);
});

test('human approval is required when configured', async () => {
  const root = await tempProject();
  await recordEvidence(root, {
    type: 'security-review',
    status: 'PASS',
    humanApproval: false,
    summary: 'agent claim',
  });
  const gate = {
    id: 'g', phase: 'security', kind: 'exit',
    checks: [{ id: 'approval', type: 'evidence', evidenceType: 'security-review', requireHumanApproval: true }],
  };
  const blocked = await evaluateGate(root, gate, { config: defaultConfig(), state: state() });
  assert.equal(blocked.status, 'BLOCKED');

  await recordEvidence(root, {
    type: 'security-review',
    status: 'PASS',
    humanApproval: true,
    approvedBy: 'Jeremy',
    summary: 'human approved',
  });
  const passed = await evaluateGate(root, gate, { config: defaultConfig(), state: state() });
  assert.equal(passed.status, 'PASS');
  assert.match(passed.checks[0].reason, /declared, not authenticated/);
});

test('declared approval does not satisfy requireAuthenticatedApproval', async () => {
  const root = await tempProject();
  await recordEvidence(root, {
    type: 'security-review',
    status: 'PASS',
    humanApproval: true,
    approvedBy: 'Jeremy',
    summary: 'declared approval',
  });
  const config = defaultConfig();
  config.security.requireAuthenticatedApproval = true;
  const gate = {
    id: 'g', phase: 'security', kind: 'exit',
    checks: [{ id: 'approval', type: 'evidence', evidenceType: 'security-review', requireHumanApproval: true }],
  };
  const report = await evaluateGate(root, gate, { config, state: state() });
  assert.equal(report.status, 'NOT_PROVEN');
  assert.match(report.checks[0].reason, /declared approval only/);
});

test('non-blocking NOT_APPLICABLE checks do not prevent an informative gate from PASSing', async () => {
  const root = await tempProject();
  const gate = {
    id: 'g', phase: 'release', kind: 'exit', applicability: 'informative',
    checks: [
      { id: 'manual', type: 'manual', blocking: false },
      { id: 'always', type: 'file-exists', path: '.aidf/docs/constitution.md', blocking: false },
    ],
  };
  await fsp.writeFile(path.join(root, '.aidf/docs/constitution.md'), 'x', 'utf8');
  const report = await evaluateGate(root, gate, { config: defaultConfig(), state: state() });
  assert.equal(report.status, 'PASS');
});

test('a gate with no blocking check cannot silently PASS', async () => {
  const root = await tempProject();
  const gate = {
    id: 'g', phase: 'release', kind: 'exit',
    checks: [{ id: 'always', type: 'file-exists', path: '.aidf/docs/constitution.md', blocking: false }],
  };
  await fsp.writeFile(path.join(root, '.aidf/docs/constitution.md'), 'x', 'utf8');
  const report = await evaluateGate(root, gate, { config: defaultConfig(), state: state() });
  assert.equal(report.status, 'NOT_PROVEN');
  assert.match(report.reason, /no blocking check/i);
});

test('runCommand refuses shell operators and tokenizes quoted arguments', async () => {
  const blocked = await runCommand('node -e "x" | cat');
  assert.equal(blocked.status, 'BLOCKED');
  assert.deepEqual(tokenizeCommand('node "a b" c'), ['node', 'a b', 'c']);
  const ok = await runCommand('node --version');
  assert.equal(ok.status, 'PASS');
});
