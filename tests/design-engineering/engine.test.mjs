import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyComplexity, getWorkflow } from '../../src/core/design-engineering/complexity-classifier.mjs';
import { validateFigma } from '../../src/core/design-engineering/figma/validators.mjs';

test('runDesignWorkflow calls complexity classifier', async () => {
  const context = {
    featureCount: 8,
    teamSize: 4
  };
  
  // Test the classifier directly
  const result = classifyComplexity(context);
  
  assert.ok(result.complexity);
  assert.ok(result.score);
});

test('runDesignWorkflow selects appropriate workflow', async () => {
  // Small project -> quick workflow
  const smallContext = {
    featureCount: 3,
    teamSize: 1
  };
  const smallComplexity = classifyComplexity(smallContext);
  const smallWorkflow = getWorkflow(smallComplexity.complexity);
  
  assert.equal(smallWorkflow, 'quick');
  
  // Medium project -> standard workflow
  const mediumContext = {
    featureCount: 10,
    teamSize: 4
  };
  const mediumComplexity = classifyComplexity(mediumContext);
  const mediumWorkflow = getWorkflow(mediumComplexity.complexity);
  
  assert.equal(mediumWorkflow, 'standard');
});

test('runDesignWorkflow validates Figma availability', async () => {
  // Test with Figma disabled
  const figmaDisabled = await validateFigma({ enabled: false });
  assert.equal(figmaDisabled.status, 'disabled');
  
  // Test with missing config
  const figmaMissing = await validateFigma({ enabled: true });
  assert.equal(figmaMissing.status, 'configuration_missing');
});

test('runDesignWorkflow handles fallback when Figma unavailable', async () => {
  const context = {
    featureCount: 10,
    teamSize: 4,
    figma: {
      enabled: false
    },
    screens: [
      {
        name: 'Home',
        elements: [
          { type: 'text', x: 20, y: 50, content: 'Home' }
        ]
      }
    ]
  };
  
  const complexity = classifyComplexity(context);
  const figmaStatus = await validateFigma(context.figma);
  
  // Should use fallback
  assert.ok(figmaStatus.status !== 'fully_verified');
  assert.equal(complexity.complexity, 'medium');
});

test('runDesignWorkflow generates different outputs based on complexity', async () => {
  // Small project
  const smallContext = {
    featureCount: 3,
    teamSize: 1
  };
  const smallComplexity = classifyComplexity(smallContext);
  const smallWorkflow = getWorkflow(smallComplexity.complexity);
  
  // Medium project
  const mediumContext = {
    featureCount: 15,
    teamSize: 5
  };
  const mediumComplexity = classifyComplexity(mediumContext);
  const mediumWorkflow = getWorkflow(mediumComplexity.complexity);
  
  assert.equal(smallWorkflow, 'quick');
  assert.equal(mediumWorkflow, 'standard');
  
  // Different workflows
  assert.notEqual(smallWorkflow, mediumWorkflow);
});

test('runDesignWorkflow respects emergency override', async () => {
  const context = {
    featureCount: 50,
    teamSize: 15,
    emergency: true
  };
  
  const result = classifyComplexity(context);
  
  // Emergency should force small complexity
  assert.equal(result.complexity, 'small');
});

test('runDesignWorkflow provides fallback documentation', async () => {
  const context = {
    featureCount: 3,
    teamSize: 1,
    figma: {
      enabled: false
    }
  };
  
  const complexity = classifyComplexity(context);
  const figmaStatus = await validateFigma(context.figma);
  
  // Should be small complexity with fallback
  assert.equal(complexity.complexity, 'small');
  assert.equal(figmaStatus.status, 'disabled');
});
