import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { loadAllArtefacts, resolveLink, verifyChain, findBrokenLinks, findMissingLinks, LINK_TYPES } from '../src/core/traceability/chain.mjs';

async function tempProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-traceability-'));
  await fsp.mkdir(path.join(root, '.aidf', 'artefacts'), { recursive: true });
  return root;
}

test('loadAllArtefacts returns empty Map when artefacts directory does not exist', async () => {
  const root = await tempProject();
  const artefacts = await loadAllArtefacts(root);
  assert.equal(artefacts.size, 0);
});

test('loadAllArtefacts loads artefacts from directory', async () => {
  const root = await tempProject();
  
  const req1 = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
    description: 'Test description.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {},
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const req2 = {
    id: 'REQ-F-002',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Second requirement',
    description: 'Test description.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {
      implements: ['REQ-F-001']
    },
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const artefactsDir = require('../src/core/paths.mjs').aidfPaths(root).artefacts;
  await fsp.writeFile(path.join(artefactsDir, 'req1.json'), JSON.stringify(req1, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'req2.json'), JSON.stringify(req2, null, 2));
  
  const artefacts = await loadAllArtefacts(root);
  
  assert.equal(artefacts.size, 2);
  assert.ok(artefacts.has('REQ-F-001'));
  assert.ok(artefacts.has('REQ-F-002'));
});

test('resolveLink returns artefact if it exists', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {},
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const artefactsDir = require('../src/core/paths.mjs').aidfPaths(root).artefacts;
  await fsp.writeFile(path.join(artefactsDir, 'req.json'), JSON.stringify(req, null, 2));
  
  const found = await resolveLink(root, 'REQ-F-001');
  assert.ok(found);
  assert.equal(found.id, 'REQ-F-001');
});

test('resolveLink returns null if artefact does not exist', async () => {
  const root = await tempProject();
  const found = await resolveLink(root, 'REQ-F-999');
  assert.equal(found, null);
});

test('verifyChain returns broken links when target artefact is missing', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {
      implementedBy: ['BACKEND-001'] // This artefact does not exist
    },
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const artefactsDir = require('../src/core/paths.mjs').aidfPaths(root).artefacts;
  await fsp.writeFile(path.join(artefactsDir, 'req.json'), JSON.stringify(req, null, 2));
  
  const result = await verifyChain(root, 'REQ-F-001');
  
  assert.equal(result.ok, false);
  assert.ok(result.brokenLinks.length > 0);
  assert.ok(result.brokenLinks.some(l => l.includes('BACKEND-001')));
});

test('verifyChain returns path when chain is complete', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {
      implementedBy: ['BACKEND-001']
    },
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const backend = {
    id: 'BACKEND-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Backend service',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {},
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const artefactsDir = require('../src/core/paths.mjs').aidfPaths(root).artefacts;
  await fsp.writeFile(path.join(artefactsDir, 'req.json'), JSON.stringify(req, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'backend.json'), JSON.stringify(backend, null, 2));
  
  const result = await verifyChain(root, 'REQ-F-001');
  
  assert.equal(result.ok, true);
  assert.ok(result.path.length >= 2);
  assert.ok(result.path.includes('REQ-F-001'));
  assert.ok(result.path.includes('BACKEND-001'));
  assert.equal(result.brokenLinks.length, 0);
});

test('findBrokenLinks returns empty array when no broken links', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {},
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const artefactsDir = require('../src/core/paths.mjs').aidfPaths(root).artefacts;
  await fsp.writeFile(path.join(artefactsDir, 'req.json'), JSON.stringify(req, null, 2));
  
  const broken = await findBrokenLinks(root);
  assert.equal(broken.length, 0);
});

test('findMissingLinks returns artefacts missing a specific link type', async () => {
  const root = await tempProject();
  
  const req1 = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test 1',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {
      implementedBy: ['BACKEND-001']
    },
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const req2 = {
    id: 'REQ-F-002',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test 2',
    description: 'Test.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {},
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const artefactsDir = require('../src/core/paths.mjs').aidfPaths(root).artefacts;
  await fsp.writeFile(path.join(artefactsDir, 'req1.json'), JSON.stringify(req1, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'req2.json'), JSON.stringify(req2, null, 2));
  
  const missing = await findMissingLinks(root, { type: 'design' });
  
  assert.ok(missing.length >= 1);
  assert.ok(missing.some(m => m.id === 'REQ-F-002'));
});

test('LINK_TYPES exports correct values', () => {
  assert.ok(Array.isArray(LINK_TYPES));
  assert.ok(LINK_TYPES.includes('implements'));
  assert.ok(LINK_TYPES.includes('designed-by'));
  assert.ok(LINK_TYPES.includes('implemented-by'));
  assert.ok(LINK_TYPES.includes('verified-by'));
  assert.ok(LINK_TYPES.includes('evidenced-by'));
});