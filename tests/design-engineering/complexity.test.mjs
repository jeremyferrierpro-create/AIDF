import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyComplexity, getWorkflow } from '../../src/core/design-engineering/complexity-classifier.mjs';

test('classifyComplexity returns small for MVP project', async () => {
  const context = {
    featureCount: 3,
    teamSize: 1,
    timelineWeeks: 1,
    budget: 5000,
    mvpMode: true
  };
  
  const result = classifyComplexity(context);
  
  assert.equal(result.complexity, 'small');
  assert.ok(result.score < 1.5);
});

test('classifyComplexity returns medium for standard project', async () => {
  const context = {
    featureCount: 10,
    teamSize: 4,
    timelineWeeks: 6,
    budget: 35000
  };
  
  const result = classifyComplexity(context);
  
  assert.equal(result.complexity, 'medium');
  assert.ok(result.score >= 1.5 && result.score < 2.5);
});

test('classifyComplexity returns large for enterprise project', async () => {
  const context = {
    featureCount: 60,
    teamSize: 10,
    timelineWeeks: 12,
    budget: 150000
  };
  
  const result = classifyComplexity(context);
  
  assert.equal(result.complexity, 'large');
  assert.ok(result.score >= 2.5 && result.score < 3.5);
});

test('classifyComplexity respects emergency override', async () => {
  const context = {
    featureCount: 50,
    teamSize: 15,
    timelineWeeks: 20,
    budget: 500000,
    emergency: true
  };
  
  const result = classifyComplexity(context);
  
  // Emergency overrides to small
  assert.equal(result.complexity, 'small');
});

test('getWorkflow returns quick for small complexity', async () => {
  const workflow = getWorkflow('small');
  
  assert.equal(workflow, 'quick');
});

test('getWorkflow returns standard for medium complexity', async () => {
  const workflow = getWorkflow('medium');
  
  assert.equal(workflow, 'standard');
});

test('getWorkflow returns extended for large complexity', async () => {
  const workflow = getWorkflow('large');
  
  assert.equal(workflow, 'extended');
});

test('classifyComplexity factors are correct', async () => {
  const context = {
    featureCount: 8,
    teamSize: 3,
    timelineWeeks: 4,
    budget: 25000
  };
  
  const result = classifyComplexity(context);
  
  assert.ok(result.factors.projectSize);
  assert.ok(result.factors.teamSize);
  assert.ok(result.factors.timeline);
  assert.ok(result.factors.budget);
});

test('classifyComplexity handles missing values', async () => {
  const context = {};
  
  const result = classifyComplexity(context);
  
  assert.ok(result.complexity);
  assert.ok(result.score);
});
