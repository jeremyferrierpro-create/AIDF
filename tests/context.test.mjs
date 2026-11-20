import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { assembleContext, renderContextMarkdown } from '../src/core/context.mjs';
import { defaultConfig } from '../src/core/config.mjs';

const REGISTRY = {
  skills: [
    { id: 'aidf-project-context', name: 'aidf-project-context', status: 'AVAILABLE', path: '.qoder/skills/aidf-project-context', description: 'context' },
    { id: 'aidf-backend-implementation', name: 'aidf-backend-implementation', status: 'AVAILABLE', path: '.qoder/skills/aidf-backend-implementation', description: 'backend' },
    { id: 'aidf-architecture-review', name: 'aidf-architecture-review', status: 'AVAILABLE', path: '.qoder/skills/aidf-architecture-review', description: 'architecture' },
  ],
};

const ACTIVATION = {
  always: { documents: ['constitution'], skills: ['aidf-project-context'] },
  byKeyword: [
    { keywords: ['api'], documents: ['BACKEND'], skills: ['aidf-backend-implementation'] },
  ],
  contradictionSensitive: ['SECURITY'],
};

const PHASES = [
  {
    id: 'planning',
    name: 'Planning',
    requiredDocuments: ['TRD'],
    skills: ['aidf-architecture-review'],
  },
];

function state() {
  return { schemaVersion: 1, currentPhase: 'planning', completed: false, gates: {}, history: [] };
}

function contextOptions(extra = {}) {
  return {
    config: extra.config ?? defaultConfig(),
    activation: ACTIVATION,
    phases: PHASES,
    state: state(),
    registry: REGISTRY,
    ...extra,
  };
}

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-context-'));
}

test('assembleContext selects always-on, phase and keyword documents/skills', async () => {
  const root = await tempRoot();
  const context = await assembleContext(root, 'add an api endpoint', contextOptions());
  assert.equal(context.status, 'OK');
  const docs = context.documents.map((d) => d.id);
  assert.ok(docs.includes('constitution'));
  assert.ok(docs.includes('TRD'));
  assert.ok(docs.includes('BACKEND'));
  const skills = context.skills.map((s) => s.id);
  assert.ok(skills.includes('aidf-project-context'));
  assert.ok(skills.includes('aidf-architecture-review'));
  assert.ok(skills.includes('aidf-backend-implementation'));
});

test('assembleContext reports a contradiction when a sensitive document is BLOCKED', async () => {
  const root = await tempRoot();
  const config = defaultConfig();
  config.documents.SECURITY.status = 'BLOCKED';
  config.documents.SECURITY.note = 'threat model missing';
  const context = await assembleContext(root, 'review security', contextOptions({ config }));
  assert.equal(context.status, 'BLOCKED');
  assert.equal(context.contradictions.length, 1);
  assert.equal(context.contradictions[0].document, 'SECURITY');
  const markdown = renderContextMarkdown(context, config);
  assert.match(markdown, /SECURITY\*\* is BLOCKED/);
  assert.match(markdown, /Threat|threat model missing/);
});

test('assembleContext enforces maxSkills while keeping always-on skills', async () => {
  const root = await tempRoot();
  const config = defaultConfig();
  config.context.maxSkills = 1;
  config.skills.maxActive = 1;
  const context = await assembleContext(root, 'add an api endpoint', contextOptions({ config }));
  assert.deepEqual(context.skills.map((s) => s.id), ['aidf-project-context']);
});

test('assembleContext marks unknown configured documents as MISSING', async () => {
  const root = await tempRoot();
  const context = await assembleContext(root, 'plan the work', contextOptions());
  const trd = context.documents.find((d) => d.id === 'TRD');
  assert.equal(trd.exists, true);
  // constitution is configured by default, TRD too; an unknown activation entry is not.
  const activation = {
    ...ACTIVATION,
    always: { documents: ['constitution', 'GHOST'], skills: [] },
  };
  const second = await assembleContext(root, 'plan', contextOptions({ activation }));
  const ghost = second.documents.find((d) => d.id === 'GHOST');
  assert.equal(ghost.exists, false);
  assert.equal(ghost.status, 'MISSING');
});
