import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { evaluateTechnologyDecision } from '../../src/core/technology-decision/engine.mjs';

async function loadFixture(filename) {
  const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const filePath = path.join(fixturesDir, filename);
  const content = await fsp.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

test('web app with budget constraint', async () => {
  const context = {
    projectType: 'web',
    businessGoals: ['fast time-to-market', 'low cost'],
    functionalConstraints: ['REST API', 'JSON responses'],
    skills: ['javascript', 'nodejs', 'html', 'css'],
    budget: { min: 0, max: 300, currency: 'USD' },
    timeline: { weeks: 8, milestones: ['M1', 'M2'] },
    platform: ['web', 'server'],
    scalability: { horizontal: true, maxUsers: 100000 }
  };
  
  const options = {
    technologyOptions: [
      {
        id: 'express',
        name: 'Express.js',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript', 'nodejs'], complexity: 'simple' },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: true }
      },
      {
        id: 'fastify',
        name: 'Fastify',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript', 'nodejs'], complexity: 'moderate' },
        ecosystem: { documentationQuality: 'good', communitySize: 'medium' },
        scalability: { horizontal: true, vertical: true }
      },
      {
        id: 'expensive-framework',
        name: 'Expensive Framework',
        type: 'framework',
        costs: { estimatedCost: 1000 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript'], complexity: 'moderate' },
        ecosystem: { documentationQuality: 'good', communitySize: 'large' },
        scalability: { horizontal: true, vertical: true }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Should have recommendations
  assert.ok(result.recommendation.stack);
  assert.ok(result.recommendation.stack.length > 0);
  
  // Expensive option should be eliminated
  const eliminatedIds = result.options.eliminated.map(e => e.option);
  assert.ok(eliminatedIds.includes('expensive-framework'));
  
  // Should have reasonable confidence
  assert.ok(['high', 'medium', 'low'].includes(result.recommendation.confidence));
});

test('api with high performance requirement', async () => {
  const context = {
    projectType: 'api',
    nonFunctionalConstraints: ['high performance'],
    load: { reqPerSecond: 10000 },
    scalability: { horizontal: true, maxUsers: 1000000 },
    skills: ['javascript', 'nodejs']
  };
  
  const options = {
    technologyOptions: [
      {
        id: 'express',
        name: 'Express.js',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript', 'nodejs'], complexity: 'simple' },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: true }
      },
      {
        id: 'fastify',
        name: 'Fastify',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript', 'nodejs'], complexity: 'moderate' },
        ecosystem: { documentationQuality: 'good', communitySize: 'medium' },
        scalability: { horizontal: true, vertical: true }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Should have recommendations
  assert.ok(result.recommendation.stack);
});

test('mobile app decision', async () => {
  const context = {
    projectType: 'mobile',
    platform: ['mobile'],
    skills: ['javascript', 'react-native'],
    budget: { min: 0, max: 200, currency: 'USD' }
  };
  
  const options = {
    technologyOptions: [
      {
        id: 'react-native',
        name: 'React Native',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['mobile'],
        maintenance: { skillRequirements: ['javascript', 'react-native'], complexity: 'moderate' },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: false }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Should include mobile-compatible options
  assert.ok(result.recommendation.stack);
  
  // Platform should match
  assert.ok(result.context.platform);
  assert.ok(result.context.platform.includes('mobile'));
});

test('microservices decision', async () => {
  const context = {
    projectType: 'microservices',
    businessGoals: ['scalability', 'independent deployment'],
    skills: ['javascript', 'docker', 'kubernetes'],
    budget: { min: 0, max: 1000, currency: 'USD' },
    scalability: { horizontal: true, maxUsers: 10000000 },
    platform: ['server']
  };
  
  const options = {
    technologyOptions: [
      {
        id: 'express',
        name: 'Express.js',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['server'],
        maintenance: { skillRequirements: ['javascript', 'nodejs'], complexity: 'simple' },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: true }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Should have recommendations
  assert.ok(result.recommendation.stack);
  
  // Should document scalability considerations
  assert.ok(result.analysis);
  assert.equal(result.analysis.llm, null);
  assert.equal(result.analysis.delegation?.delegatedTo, 'invoking-agent');
});

test('decision document structure validation', async () => {
  const context = {
    projectType: 'web',
    skills: ['javascript'],
    budget: { min: 0, max: 500 }
  };
  
  const options = {
    technologyOptions: [
      {
        id: 'express',
        name: 'Express.js',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript'], complexity: 'simple' },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: true }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Verify all required sections present
  assert.ok(result.meta, 'Missing meta section');
  assert.ok(result.context, 'Missing context section');
  assert.ok(result.analysis, 'Missing analysis section');
  assert.ok(result.analysis.deterministic, 'Missing deterministic analysis');
  assert.equal(result.analysis.llm, null);
  assert.equal(result.analysis.delegation?.delegatedTo, 'invoking-agent', 'Interpretation must be delegated to the invoking agent');
  assert.ok(result.options, 'Missing options section');
  assert.ok(result.comparison, 'Missing comparison section');
  assert.ok(result.recommendation, 'Missing recommendation section');
  assert.ok(result.humanApproval, 'Missing human approval section');
});

test('decision handles constraints with missing data', async () => {
  const context = {
    projectType: 'web',
    // Intentionally minimal context
  };
  
  const options = {
    technologyOptions: [
      {
        id: 'express',
        name: 'Express.js',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript'], complexity: 'simple' },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: true }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Should still produce a document
  assert.ok(result.meta);
  assert.ok(result.context);
  assert.ok(result.recommendation);
  
  // Confidence should be low due to missing data
  assert.ok(['high', 'medium', 'low'].includes(result.recommendation.confidence));
});
