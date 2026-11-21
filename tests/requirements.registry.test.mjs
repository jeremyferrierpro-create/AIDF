import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { loadRequirementsRegistry, saveRequirementsRegistry, addRequirement, updateRequirement, deleteRequirement, calculateCoverage, filterRequirements, generateRequirementId, REQUIREMENT_STATUSES, REQUIREMENT_TYPES } from '../src/core/requirements/registry.mjs';

async function tempProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-requirements-'));
  await fsp.mkdir(path.join(root, '.aidf', 'artefacts'), { recursive: true });
  return root;
}

test('generateRequirementId produces valid IDs', () => {
  assert.equal(generateRequirementId('FUNCTIONAL', 1), 'REQ-F-001');
  assert.equal(generateRequirementId('FUNCTIONAL', 12), 'REQ-F-012');
  assert.equal(generateRequirementId('NON_FUNCTIONAL', 1), 'REQ-NF-001');
  assert.equal(generateRequirementId('NON_FUNCTIONAL', 123), 'REQ-NF-123');
});

test('generateRequirementId rejects invalid types', () => {
  assert.throws(() => generateRequirementId('INVALID', 1), /Invalid requirement type/);
});

test('addRequirement creates a requirement with all required fields', async () => {
  const root = await tempProject();
  
  const req = await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'User can login',
    description: 'Registered users can authenticate with username and password.',
    priority: 'must'
  }, { human: true, by: 'Jeremy' });
  
  assert.equal(req.id, 'REQ-F-001');
  assert.equal(req.type, 'FUNCTIONAL');
  assert.equal(req.title, 'User can login');
  assert.equal(req.description, 'Registered users can authenticate with username and password.');
  assert.equal(req.priority, 'must');
  assert.equal(req.status, 'DRAFT');
  assert.equal(req.source.type, 'human');
  assert.equal(req.source.author, 'Jeremy');
  assert.ok(req.createdAt);
  assert.ok(req.updatedAt);
  assert.ok(req.links);
  assert.ok(req.validation);
  assert.equal(req.validation.valid, true);
});

test('addRequirement generates ID when not provided', async () => {
  const root = await tempProject();
  
  const req1 = await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'First requirement',
    description: 'Description 1.'
  });
  
  const req2 = await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'Second requirement',
    description: 'Description 2.'
  });
  
  assert.equal(req1.id, 'REQ-F-001');
  assert.equal(req2.id, 'REQ-F-002');
});

test('addRequirement rejects duplicate ID', async () => {
  const root = await tempProject();
  
  await addRequirement(root, {
    id: 'REQ-F-001',
    type: 'FUNCTIONAL',
    title: 'First',
    description: 'Description 1.'
  });
  
  assert.rejects(
    async () => {
      await addRequirement(root, {
        id: 'REQ-F-001',
        type: 'FUNCTIONAL',
        title: 'Second',
        description: 'Description 2.'
      });
    },
    /already exists/
  );
});

test('addRequirement validates ID format', async () => {
  const root = await tempProject();
  
  assert.rejects(
    async () => {
      await addRequirement(root, {
        id: 'INVALID-ID',
        type: 'FUNCTIONAL',
        title: 'Invalid',
        description: 'Description.'
      });
    },
    /Invalid requirement ID format/
  );
});

test('updateRequirement modifies existing requirement', async () => {
  const root = await tempProject();
  
  const req = await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'Original title',
    description: 'Original description.'
  });
  
  assert.equal(req.title, 'Original title');
  
  const updated = await updateRequirement(root, req.id, {
    title: 'Updated title',
    priority: 'should'
  });
  
  assert.equal(updated.title, 'Updated title');
  assert.equal(updated.priority, 'should');
  assert.ok(updated.updatedAt > req.updatedAt);
});

test('updateRequirement rejects non-existent ID', async () => {
  const root = await tempProject();
  
  assert.rejects(
    async () => {
      await updateRequirement(root, 'REQ-F-999', { title: 'Update' });
    },
    /not found/
  );
});

test('deleteRequirement marks requirement as BLOCKED', async () => {
  const root = await tempProject();
  
  const req = await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'To delete',
    description: 'Description.'
  });
  
  assert.equal(req.status, 'DRAFT');
  
  const deleted = await deleteRequirement(root, req.id);
  
  assert.equal(deleted.status, 'BLOCKED');
  assert.equal(deleted.id, req.id);
});

test('deleteRequirement rejects non-existent ID', async () => {
  const root = await tempProject();
  
  assert.rejects(
    async () => {
      await deleteRequirement(root, 'REQ-F-999');
    },
    /not found/
  );
});

test('filterRequirements filters by type', async () => {
  const root = await tempProject();
  
  await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'Functional requirement',
    description: 'Description.'
  });
  
  await addRequirement(root, {
    type: 'NON_FUNCTIONAL',
    title: 'Non-functional requirement',
    description: 'Description.'
  });
  
  const registry = await loadRequirementsRegistry(root);
  
  const functional = filterRequirements(registry, { type: 'FUNCTIONAL' });
  assert.equal(functional.length, 1);
  assert.equal(functional[0].type, 'FUNCTIONAL');
  
  const nonFunctional = filterRequirements(registry, { type: 'NON_FUNCTIONAL' });
  assert.equal(nonFunctional.length, 1);
  assert.equal(nonFunctional[0].type, 'NON_FUNCTIONAL');
});

test('filterRequirements filters by status', async () => {
  const root = await tempProject();
  
  await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'Draft',
    description: 'Description.'
  });
  
  const req2 = await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'To block',
    description: 'Description.'
  });
  
  await deleteRequirement(root, req2.id);
  
  const registry = await loadRequirementsRegistry(root);
  
  const draft = filterRequirements(registry, { status: 'DRAFT' });
  assert.equal(draft.length, 1);
  
  const blocked = filterRequirements(registry, { status: 'BLOCKED' });
  assert.equal(blocked.length, 1);
});

test('calculateCoverage returns coverage structure', async () => {
  const root = await tempProject();
  
  await addRequirement(root, {
    type: 'FUNCTIONAL',
    title: 'Requirement',
    description: 'Description.',
    acceptanceCriteria: [
      {
        id: 'REQ-F-001-AC1',
        description: 'Criterion 1.'
      }
    ]
  });
  
  const result = await calculateCoverage(root);
  
  assert.ok(result.coverage);
  assert.equal(result.coverage.total, 1);
  assert.ok(result.details);
  assert.equal(result.details.length, 1);
  assert.equal(result.details[0].id, 'REQ-F-001');
});