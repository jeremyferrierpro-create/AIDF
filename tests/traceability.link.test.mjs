import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { loadAllArtefacts, resolveLink, verifyChain, findBrokenLinks, findMissingLinks, createLink, LINK_TYPES, TRACEABILITY_TYPES, generateTraceabilityReport } from '../src/core/traceability/chain.mjs';
import { aidfPaths } from '../src/core/paths.mjs';

async function tempProject() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-traceability-'));
  await fsp.mkdir(path.join(root, '.aidf', 'artefacts'), { recursive: true });
  return root;
}

test('loadArtefact returns artefact by ID', async () => {
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  
  const found = await loadAllArtefacts(root);
  assert.ok(found.has('REQ-F-001'));
  assert.equal(found.get('REQ-F-001').id, 'REQ-F-001');
});

test('createLink connects requirement to implementation', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
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
  
  const impl = {
    id: 'IMPL-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Test implementation',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'IMPL-001.json'), JSON.stringify(impl, null, 2));
  
  const result = await createLink(root, 'REQ-F-001', 'implementation', 'IMPL-001');
  
  assert.ok(result);
  assert.equal(result.linkType, 'implemented-by');
  assert.equal(result.reverseLinkType, 'implements');
  
  const artefacts = await loadAllArtefacts(root);
  assert.ok(artefacts.get('REQ-F-001').links.implementedBy.includes('IMPL-001'));
  assert.ok(artefacts.get('IMPL-001').links.implements.includes('REQ-F-001'));
});

test('createLink connects design to implementation', async () => {
  const root = await tempProject();
  
  const design = {
    id: 'DESIGN-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'design',
    title: 'Test design',
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
  
  const impl = {
    id: 'IMPL-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Test implementation',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'DESIGN-001.json'), JSON.stringify(design, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'IMPL-001.json'), JSON.stringify(impl, null, 2));
  
  const result = await createLink(root, 'DESIGN-001', 'implementation', 'IMPL-001');
  
  assert.ok(result);
  assert.equal(result.linkType, 'implemented-by');
  assert.equal(result.reverseLinkType, 'implements');
});

test('createLink connects test to requirement', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
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
  
  const test = {
    id: 'TEST-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'test',
    title: 'Test case',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'TEST-001.json'), JSON.stringify(test, null, 2));
  
  const result = await createLink(root, 'TEST-001', 'requirement', 'REQ-F-001');
  
  assert.ok(result);
  assert.equal(result.linkType, 'verifies');
  assert.equal(result.reverseLinkType, 'verified-by');
});

test('createLink throws error when source artefact not found', async () => {
  const root = await tempProject();
  
  const impl = {
    id: 'IMPL-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Test implementation',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'IMPL-001.json'), JSON.stringify(impl, null, 2));
  
  assert.rejects(
    async () => {
      await createLink(root, 'REQ-F-999', 'implementation', 'IMPL-001');
    },
    /not found/
  );
});

test('createLink throws error when target artefact not found', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  
  assert.rejects(
    async () => {
      await createLink(root, 'REQ-F-001', 'implementation', 'IMPL-999');
    },
    /not found/
  );
});

test('generateTraceabilityReport returns summary', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
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
  
  const impl = {
    id: 'IMPL-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Test implementation',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'IMPL-001.json'), JSON.stringify(impl, null, 2));
  
  const report = await generateTraceabilityReport(root);
  
  assert.ok(report);
  assert.ok(report.summary);
  assert.equal(report.summary.totalArtefacts, 2);
  assert.ok(report.summary.byType);
  assert.ok(report.summary.byType.implementation >= 1);
  assert.ok(report.coverage);
  assert.ok(report.links);
  assert.ok(report.broken);
  assert.ok(report.missing);
});

test('generateTraceabilityReport calculates coverage', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
    description: 'Test.',
    acceptanceCriteria: [
      {
        id: 'REQ-F-001-AC1',
        description: 'Criterion 1.'
      }
    ],
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {
      implementedBy: ['IMPL-001']
    },
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const impl = {
    id: 'IMPL-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Test implementation',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'IMPL-001.json'), JSON.stringify(impl, null, 2));
  
  const report = await generateTraceabilityReport(root);
  
  assert.equal(report.coverage.overall.totalRequirements, 1);
  assert.equal(report.coverage.overall.fullyTraced, 0);
  assert.ok(report.coverage.overall.coveragePercentage >= 0);
  assert.ok(report.recommendations);
});

test('generateTraceabilityReport includes recommendations', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  
  const report = await generateTraceabilityReport(root);
  
  // Should have recommendation to add links
  assert.ok(report.recommendations.length >= 1);
});

test('TRACEABILITY_TYPES exports correct values', () => {
  assert.ok(TRACEABILITY_TYPES);
  assert.equal(TRACEABILITY_TYPES.requirement, 'requirement');
  assert.equal(TRACEABILITY_TYPES.design, 'design');
  assert.equal(TRACEABILITY_TYPES.implementation, 'implementation');
  assert.equal(TRACEABILITY_TYPES.test, 'test');
  assert.equal(TRACEABILITY_TYPES.evidence, 'evidence');
});

test('verifyChain handles requirement with multiple link types', async () => {
  const root = await tempProject();
  
  const req = {
    id: 'REQ-F-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'FUNCTIONAL',
    title: 'Test requirement',
    description: 'Test.',
    acceptanceCriteria: [
      {
        id: 'REQ-F-001-AC1',
        description: 'Criterion 1.'
      }
    ],
    source: {
      type: 'human',
      author: 'Jeremy',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    links: {
      implementedBy: ['IMPL-001'],
      verifiedBy: ['TEST-001']
    },
    validation: {
      schemaVersion: '1.0.0',
      timestamp: '2026-11-20T10:00:00.000Z',
      valid: true,
      errors: [],
      warnings: []
    }
  };
  
  const impl = {
    id: 'IMPL-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'implementation',
    title: 'Test implementation',
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
  
  const test = {
    id: 'TEST-001',
    schemaVersion: '1.0.0',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    status: 'DRAFT',
    type: 'test',
    title: 'Test case',
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
  
  const artefactsDir = aidfPaths(root).artefacts.dir;
  await fsp.writeFile(path.join(artefactsDir, 'REQ-F-001.json'), JSON.stringify(req, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'IMPL-001.json'), JSON.stringify(impl, null, 2));
  await fsp.writeFile(path.join(artefactsDir, 'TEST-001.json'), JSON.stringify(test, null, 2));
  
  const result = await verifyChain(root, 'REQ-F-001');
  
  assert.ok(result.path.length >= 2);
});
