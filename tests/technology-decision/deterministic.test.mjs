import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHardConstraints, calculateSoftConstraints, detectIncompatibilities, rankOptions } from '../../src/core/technology-decision/analyzer-deterministic.mjs';

test('validateHardConstraints eliminates options exceeding budget', async () => {
  const options = [
    { id: 'option1', costs: { estimatedCost: 100 }, platform: ['web'] },
    { id: 'option2', costs: { estimatedCost: 600 }, platform: ['web'] }
  ];
  
  const context = { budget: { max: 500 }, platform: ['web'] };
  
  const { validOptions, eliminated } = await validateHardConstraints(options, context);
  
  assert.equal(validOptions.length, 1);
  assert.equal(validOptions[0].id, 'option1');
  assert.equal(eliminated.length, 1);
  assert.equal(eliminated[0].option, 'option2');
  assert.ok(eliminated[0].violations.some(v => v.constraint === 'budget'));
});

test('validateHardConstraints validates platform compatibility', async () => {
  const options = [
    { id: 'option1', costs: { estimatedCost: 100 }, platform: ['web', 'mobile'] },
    { id: 'option2', costs: { estimatedCost: 100 }, platform: ['web'] }
  ];
  
  const context = { budget: { max: 500 }, platform: ['web', 'mobile'] };
  
  const { validOptions, eliminated } = await validateHardConstraints(options, context);
  
  assert.equal(validOptions.length, 1);
  assert.equal(validOptions[0].id, 'option1');
  assert.equal(eliminated.length, 1);
  assert.equal(eliminated[0].option, 'option2');
});

test('validateHardConstraints validates license compatibility', async () => {
  const options = [
    { id: 'option1', costs: { estimatedCost: 100 }, license: 'MIT' },
    { id: 'option2', costs: { estimatedCost: 100 }, license: 'GPL' }
  ];
  
  const context = { 
    budget: { max: 500 }, 
    license: ['MIT', 'Apache-2.0'] 
  };
  
  const { validOptions, eliminated } = await validateHardConstraints(options, context);
  
  assert.equal(validOptions.length, 1);
  assert.equal(validOptions[0].id, 'option1');
  assert.equal(eliminated.length, 1);
  assert.equal(eliminated[0].option, 'option2');
});

test('calculateSoftConstraints scores skill match', async () => {
  const options = [
    {
      id: 'express',
      maintenance: { skillRequirements: ['javascript', 'nodejs'] },
      ecosystem: { documentationQuality: 'excellent', communitySize: 'huge' }
    }
  ];
  
  const context = { skills: ['javascript', 'nodejs'] };
  
  const scores = calculateSoftConstraints(options, context);
  
  assert.equal(scores[0].option, 'express');
  assert.equal(scores[0].scores.skillMatch, 1.0);
  assert.equal(scores[0].scores.ecosystem, 1.0);
  assert.equal(scores[0].scores.community, 1.0);
  assert.ok(scores[0].totalScore > 0);
});

test('calculateSoftConstraints handles missing skills', async () => {
  const options = [
    {
      id: 'express',
      maintenance: { skillRequirements: ['javascript', 'python', 'java'] },
      ecosystem: { documentationQuality: 'good', communitySize: 'large' }
    }
  ];
  
  const context = { skills: ['javascript'] };
  
  const scores = calculateSoftConstraints(options, context);
  
  assert.equal(scores[0].scores.skillMatch, 1/3); // Only 1 of 3 skills match
});

test('calculateSoftConstraints handles scalability', async () => {
  const options = [
    {
      id: 'option1',
      scalability: { horizontal: true, vertical: true }
    }
  ];
  
  const context = { scalability: { horizontal: true } };
  
  const scores = calculateSoftConstraints(options, context);
  
  assert.equal(scores[0].scores.scalability, 1.0);
});

test('detectIncompatibilities finds conflicts', async () => {
  const options = [
    {
      id: 'option1',
      compatibility: { incompatibleWith: ['option2'] }
    },
    { id: 'option2' }
  ];
  
  const incompatibilities = detectIncompatibilities(options);
  
  assert.equal(incompatibilities.length, 1);
  assert.equal(incompatibilities[0].option1, 'option1');
  assert.equal(incompatibilities[0].option2, 'option2');
});

test('rankOptions sorts by score', async () => {
  const validOptions = [
    { id: 'express', costs: { estimatedCost: 0 } },
    { id: 'fastify', costs: { estimatedCost: 0 } }
  ];
  
  const scores = [
    { option: 'express', totalScore: 0.8 },
    { option: 'fastify', totalScore: 0.9 }
  ];
  
  const incompatibilities = [];
  
  const ranked = rankOptions(validOptions, scores, incompatibilities);
  
  assert.equal(ranked.shortlisted.length, 2);
  // Should be sorted by score (descending)
  assert.equal(ranked.shortlisted[0].option, 'fastify');
});

test('rankOptions filters by score threshold', async () => {
  const validOptions = [
    { id: 'express', costs: { estimatedCost: 0 } },
    { id: 'low-score', costs: { estimatedCost: 0 } }
  ];
  
  const scores = [
    { option: 'express', totalScore: 0.8 },
    { option: 'low-score', totalScore: 0.3 }
  ];
  
  const incompatibilities = [];
  
  const ranked = rankOptions(validOptions, scores, incompatibilities);
  
  // Only high-score option should be shortlisted
  assert.equal(ranked.shortlisted.length, 1);
  assert.equal(ranked.shortlisted[0].option, 'express');
});

test('rankOptions handles incompatibilities', async () => {
  const validOptions = [
    { id: 'option1', costs: { estimatedCost: 0 } },
    { id: 'option2', costs: { estimatedCost: 0 } }
  ];
  
  const scores = [
    { option: 'option1', totalScore: 0.9 },
    { option: 'option2', totalScore: 0.8 }
  ];
  
  const incompatibilities = [
    { option1: 'option1', option2: 'option2' }
  ];
  
  const ranked = rankOptions(validOptions, scores, incompatibilities);
  
  // Both options are incompatible - neither should be shortlisted
  assert.equal(ranked.shortlisted.length, 0);
  assert.equal(ranked.incompatible.length, 1);
});
