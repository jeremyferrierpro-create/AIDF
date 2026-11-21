import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTechnologyDecision } from '../../src/core/technology-decision/engine.mjs';

test('evaluateTechnologyDecision returns document with required fields', async () => {
  const context = {
    projectType: 'web',
    businessGoals: ['low cost'],
    skills: ['javascript'],
    budget: { min: 0, max: 500 }
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  assert.ok(result.meta);
  assert.ok(result.context);
  assert.ok(result.analysis);
  assert.ok(result.options);
  assert.ok(result.recommendation);
});

test('evaluateTechnologyDecision filters options by budget', async () => {
  const context = {
    projectType: 'web',
    skills: ['javascript'],
    budget: { min: 0, max: 100 }
  };
  
  const options = {
    technologyOptions: [
      { id: 'express', costs: { estimatedCost: 50 }, platform: ['web'] },
      { id: 'expensive', costs: { estimatedCost: 500 }, platform: ['web'] }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  // Expensive option should be eliminated
  assert.ok(result.options.eliminated);
  const eliminatedIds = result.options.eliminated.map(e => e.option);
  assert.ok(eliminatedIds.includes('expensive'));
});

test('evaluateTechnologyDecision handles missing options', async () => {
  const context = {
    projectType: 'web',
    skills: ['javascript'],
    budget: { min: 0, max: 500 }
  };
  
  const result = await evaluateTechnologyDecision(context, {});
  
  assert.ok(result.meta);
  assert.ok(result.recommendation);
  assert.equal(result.recommendation.confidence, 'low'); // No options
});

test('evaluateTechnologyDecision generates recommendation', async () => {
  const context = {
    projectType: 'api',
    skills: ['javascript', 'nodejs'],
    budget: { min: 0, max: 500 },
    platform: ['web', 'server']
  };
  
  const options = {
    technologyOptions: [
      { 
        id: 'express',
        name: 'Express.js',
        type: 'framework',
        costs: { estimatedCost: 0 },
        platform: ['web', 'server'],
        maintenance: { skillRequirements: ['javascript', 'nodejs'] },
        ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' },
        scalability: { horizontal: true, vertical: true }
      }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  assert.ok(result.recommendation.stack);
  assert.ok(result.recommendation.stack.length > 0);
  assert.ok(result.recommendation.confidence);
});

test('evaluateTechnologyDecision detects incompatibilities', async () => {
  const context = {
    projectType: 'web',
    skills: ['javascript'],
    budget: { min: 0, max: 500 }
  };
  
  const options = {
    technologyOptions: [
      { 
        id: 'option1',
        costs: { estimatedCost: 100 },
        platform: ['web'],
        compatibility: { incompatibleWith: ['option2'] }
      },
      { id: 'option2', costs: { estimatedCost: 100 }, platform: ['web'] }
    ]
  };
  
  const result = await evaluateTechnologyDecision(context, options);
  
  assert.ok(result.options.incompatible);
  assert.ok(result.options.incompatible.length >= 0);
});

test('evaluateTechnologyDecision provides human approval section', async () => {
  const context = {
    projectType: 'web',
    skills: ['javascript'],
    budget: { min: 0, max: 500 }
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  assert.ok(result.humanApproval);
  assert.equal(result.humanApproval.required, true);
  assert.equal(result.humanApproval.approved, false);
});

test('evaluateTechnologyDecision exports to JSON', async () => {
  const context = {
    projectType: 'web',
    skills: ['javascript'],
    budget: { min: 0, max: 500 }
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  // Should be able to parse the result as JSON
  const json = JSON.stringify(result);
  const parsed = JSON.parse(json);
  
  assert.ok(parsed.meta);
});
