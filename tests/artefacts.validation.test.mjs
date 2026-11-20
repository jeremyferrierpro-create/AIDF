import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { validateArtefact, resolveLinks, getAllArtefactIds, hashArtefact, ARTIFACT_STATUSES } from '../src/core/artefacts/validation.mjs';

async function tempProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-artefacts-'));
  return root;
}

test('validateArtefact accepts valid artefact with all required fields', async () => {
  const valid = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
    description: 'This is a test requirement for validation.',
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
  
  const result = await validateArtefact(valid);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateArtefact rejects artefact with missing required field', async () => {
  const missing = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    // createdAt missing
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
    description: 'This is a test requirement for validation.',
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
  
  const result = await validateArtefact(missing);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('createdAt')));
});

test('validateArtefact rejects invalid status', async () => {
  const invalid = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'INVALID_STATUS', // Not in ARTIFACT_STATUSES
    type: 'FUNCTIONAL',
    title: 'Test requirement',
    description: 'This is a test requirement for validation.',
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
  
  const result = await validateArtefact(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('INVALID_STATUS')));
});

test('validateArtefact accepts valid source types', async () => {
  for (const type of ['human', 'generated', 'derived']) {
    const valid = {
      id: 'REQ-F-001',
      schemaVersion: '1.0.0',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      status: 'DRAFT',
      type: 'FUNCTIONAL',
      title: 'Test',
      description: 'Test description.',
      source: {
        type,
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
    
    const result = await validateArtefact(valid);
    assert.equal(result.valid, true, `Source type ${type} should be valid`);
  }
});

test('hashArtefact produces deterministic hash', async () => {
  const body = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test',
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
  
  const hash1 = hashArtefact(body);
  const hash2 = hashArtefact(body);
  
  assert.equal(hash1, hash2, 'Hash should be deterministic');
  assert.ok(hash1.length > 0, 'Hash should not be empty');
});

test('validateArtefact accepts all valid statuses', async () => {
  for (const status of ARTIFACT_STATUSES) {
    const valid = {
      id: 'REQ-F-001',
      schemaVersion: '1.0.0',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      status,
      type: 'FUNCTIONAL',
      title: 'Test',
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
    
    const result = await validateArtefact(valid);
    assert.equal(result.valid, true, `Status ${status} should be valid`);
  }
});

test('validateArtefact validates validation object structure', async () => {
  const missingValidation = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test',
    description: 'Test description.',
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {},
    // validation missing
  };
  
  const result = await validateArtefact(missingValidation);
  assert.equal(result.valid, true, 'validation is optional at this level');
});

test('getAllArtefactIds returns empty Set when artefacts directory does not exist', async () => {
  const root = await tempProject();
  const ids = await getAllArtefactIds(root);
  assert.equal(ids.size, 0);
});