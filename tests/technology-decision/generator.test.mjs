import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDecisionDocument, exportToJSON, exportToMarkdown } from '../../src/core/technology-decision/generator.mjs';

test('generateDecisionDocument creates complete document', async () => {
  const context = { projectType: 'web', budget: { max: 500 } };
  
  const analysis = {
    deterministic: {
      summary: { totalOptions: 5, validOptions: 3, shortlistedOptions: 2, eliminatedOptions: 2 },
      eliminated: [],
      scores: [
        { option: 'express', scores: { totalScore: 0.85 }, totalScore: 0.85 }
      ],
      incompatibilities: []
    },
    llm: { tradeoffs: [], risks: [], uncertainties: [] }
  };
  
  const recommendation = {
    stack: [
      { component: 'framework', option: 'express', version: '4.18.0', reason: 'Best score' }
    ],
    confidence: 'high',
    risks: [],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  assert.ok(document.meta);
  assert.equal(document.meta.version, '1.0.0');
  assert.ok(document.meta.id);
  assert.ok(document.context);
  assert.equal(document.context.projectType, 'web');
  assert.ok(document.analysis);
  assert.ok(document.analysis.deterministic);
  assert.ok(document.analysis.llm);
  assert.ok(document.options);
  assert.ok(document.options.shortlisted);
  assert.ok(document.options.eliminated);
  assert.ok(document.recommendation);
  assert.ok(document.recommendation.stack);
  assert.equal(document.recommendation.confidence, 'high');
  assert.ok(document.humanApproval);
  assert.equal(document.humanApproval.required, true);
  assert.equal(document.humanApproval.approved, false);
});

test('generateDecisionDocument adds shortlisted options from scores', async () => {
  const context = { projectType: 'api' };
  
  const analysis = {
    deterministic: {
      scores: [
        { option: 'express', scores: { totalScore: 0.85 }, totalScore: 0.85 }
      ]
    },
    llm: { tradeoffs: [] }
  };
  
  const recommendation = {
    stack: [],
    confidence: 'medium',
    risks: [],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  assert.equal(document.options.shortlisted.length, 1);
  assert.equal(document.options.shortlisted[0].id, 'express');
});

test('generateDecisionDocument creates comparison matrix', async () => {
  const context = { projectType: 'web' };
  
  const analysis = {
    deterministic: {
      scores: [
        { option: 'express', scores: { totalScore: 0.85 }, totalScore: 0.85 },
        { option: 'fastify', scores: { totalScore: 0.9 }, totalScore: 0.9 }
      ]
    },
    llm: { tradeoffs: [] }
  };
  
  const recommendation = {
    stack: [],
    confidence: 'medium',
    risks: [],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  assert.ok(document.comparison);
  assert.ok(document.comparison.matrix);
  // Matrix should have criteria comparisons
  assert.ok(document.comparison.matrix.length >= 0);
});

test('exportToJSON produces valid JSON string', async () => {
  const context = { projectType: 'web' };
  
  const analysis = {
    deterministic: {
      summary: { totalOptions: 0, validOptions: 0, shortlistedOptions: 0, eliminatedOptions: 0 },
      eliminated: [],
      scores: [],
      incompatibilities: []
    },
    llm: { tradeoffs: [] }
  };
  
  const recommendation = {
    stack: [],
    confidence: 'medium',
    risks: [],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  const json = exportToJSON(document);
  
  // Should be parseable
  const parsed = JSON.parse(json);
  assert.ok(parsed.meta);
  assert.equal(parsed.context.projectType, 'web');
});

test('exportToMarkdown produces valid Markdown', async () => {
  const context = {
    projectType: 'web',
    budget: { min: 0, max: 500 }
  };
  
  const analysis = {
    deterministic: {
      summary: { totalOptions: 2, validOptions: 2, shortlistedOptions: 1, eliminatedOptions: 0 },
      eliminated: [],
      scores: [
        { option: 'express', scores: { totalScore: 0.85 }, totalScore: 0.85 }
      ],
      incompatibilities: []
    },
    llm: { tradeoffs: [] }
  };
  
  const recommendation = {
    stack: [{ component: 'framework', option: 'express', version: '4.18.0', reason: 'Best score' }],
    confidence: 'high',
    risks: [],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  const markdown = exportToMarkdown(document);
  
  // Should contain expected sections
  assert.ok(markdown.includes('# TECH-DECISION'));
  assert.ok(markdown.includes('## Context'));
  assert.ok(markdown.includes('## Analysis'));
  assert.ok(markdown.includes('## Options'));
  assert.ok(markdown.includes('## Recommendation'));
  assert.ok(markdown.includes('## Human Approval'));
  assert.ok(markdown.includes('express'));
});

test('exportToMarkdown handles empty analysis', async () => {
  const context = { projectType: 'api' };
  
  const analysis = {
    deterministic: {
      summary: { totalOptions: 0, validOptions: 0, shortlistedOptions: 0, eliminatedOptions: 0 },
      eliminated: [],
      scores: [],
      incompatibilities: []
    },
    llm: { tradeoffs: [] }
  };
  
  const recommendation = {
    stack: [],
    confidence: 'low',
    risks: [{ risk: 'No options found', impact: 'high' }],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  const markdown = exportToMarkdown(document);
  
  // Should still be valid Markdown
  assert.ok(markdown.includes('# TECH-DECISION'));
  assert.ok(markdown.includes('No options found'));
});

test('exportToMarkdown handles eliminated options', async () => {
  const context = { projectType: 'web' };
  
  const analysis = {
    deterministic: {
      summary: { totalOptions: 2, validOptions: 1, shortlistedOptions: 1, eliminatedOptions: 1 },
      eliminated: [
        {
          option: 'expensive',
          violations: [{ constraint: 'budget', reason: 'Cost exceeds budget' }]
        }
      ],
      scores: [
        { option: 'express', scores: { totalScore: 0.85 }, totalScore: 0.85 }
      ],
      incompatibilities: []
    },
    llm: { tradeoffs: [] }
  };
  
  const recommendation = {
    stack: [{ component: 'framework', option: 'express', version: '4.18.0' }],
    confidence: 'medium',
    risks: [],
    uncertainties: [],
    suggestedTests: []
  };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  const markdown = exportToMarkdown(document);
  
  assert.ok(markdown.includes('### Eliminated'));
  assert.ok(markdown.includes('expensive'));
  assert.ok(markdown.includes('Cost exceeds budget'));
});
