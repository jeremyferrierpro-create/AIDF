# L2-07: Technology Decision Engine Implementation

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Finalize the implementation plan for L2 Technology Decision Engine.

## Decision

### File Structure

```
src/core/technology-decision/
├── index.mjs                      # Main exports
├── engine.mjs                     # Main orchestrator
├── analyzer-deterministic.mjs     # Rule-based analysis
├── analyzer-llm.mjs               # LLM analysis
├── generator.mjs                  # Document generator
├── options/
│   ├── databases.mjs              # Database options
│   ├── frameworks.mjs             # Framework options
│   ├── servers.mjs                # Server options
│   ├── languages.mjs              # Language options
│   ├── cloud.mjs                  # Cloud options
│   └── tools.mjs                  # Tool options
├── constraints/
│   ├── functional.mjs             # Functional constraints
│   ├── non-functional.mjs         # Non-functional constraints
│   └── business.mjs               # Business constraints
├── utils/
│   ├── comparison.mjs             # Comparison helpers
│   └── scoring.mjs                # Scoring helpers
└── templates/
    └── llm-prompts.mjs            # LLM prompt templates
```

### Implementation Steps

#### Step 1: Define Options (options/*.mjs)

Create option definitions for common technologies:
```javascript
// options/frameworks.mjs
export const FRAMEWORKS = {
  express: {
    id: 'express',
    name: 'Express.js',
    type: 'framework',
    version: '4.18.0',
    // ... full definition
  },
  fastify: {
    id: 'fastify',
    name: 'Fastify',
    type: 'framework',
    version: '4.0.0',
    // ... full definition
  }
};
```

#### Step 2: Implement Deterministic Analyzer (analyzer-deterministic.mjs)

Implement:
- `validateHardConstraints(options, context)`
- `calculateSoftConstraints(options, context)`
- `detectIncompatibilities(options)`
- `rankOptions(validOptions, scores, incompatibilities)`

#### Step 3: Implement LLM Analyzer (analyzer-llm.mjs)

Implement:
- `analyzeTradeoffs(projectContext, options)`
- `assessRisks(projectContext, stack)`
- `compareArchitectures(projectContext, architectures)`
- `documentUncertainties(projectContext, stack)`
- `generateExplanation(projectContext, decision)`

#### Step 4: Implement Generator (generator.mjs)

Implement:
- `generateDecisionDocument(context, analysis, recommendation)`
- `exportToJSON(document)`
- `exportToMarkdown(document)`

#### Step 5: Implement Engine (engine.mjs)

Main orchestrator:
```javascript
export async function evaluateTechnologyDecision(projectContext, options, options = {}) {
  // Step 1: Validate hard constraints
  const { validOptions, eliminated } = await validateHardConstraints(options, projectContext);
  
  // Step 2: Calculate soft constraints
  const scores = calculateSoftConstraints(validOptions, projectContext);
  
  // Step 3: Detect incompatibilities
  const incompatibilities = detectIncompatibilities(validOptions);
  
  // Step 4: Get LLM analysis
  const llmAnalysis = await analyzeLLM(projectContext, validOptions);
  
  // Step 5: Generate recommendation
  const recommendation = generateRecommendation(validOptions, scores, incompatibilities, llmAnalysis);
  
  // Step 6: Generate document
  const document = generateDecisionDocument(projectContext, {
    deterministic: { eliminated, scores, incompatibilities },
    llm: llmAnalysis
  }, recommendation);
  
  return document;
}
```

#### Step 6: Create Utilities (utils/*.mjs)

Helper functions:
- `compareOptions(options, criteria)`
- `calculateScores(options, weights)`
- `formatConstraints(constraints)`

#### Step 7: Create Templates (templates/*.mjs)

LLM prompt templates:
```javascript
export const PROMPTS = {
  tradeoffs: (context, options) => `...`,
  risks: (context, stack) => `...`,
  // ... other templates
};
```

### Tests

Create test files:
```
tests/
├── technology-decision/
│   ├── engine.test.mjs
│   ├── deterministic.test.mjs
│   ├── llm.test.mjs
│   └── generator.test.mjs
```

### Example Usage

```javascript
import { evaluateTechnologyDecision } from './src/core/technology-decision/engine.mjs';

const projectContext = {
  projectType: 'web',
  businessGoals: ['fast time-to-market', 'low cost'],
  functionalConstraints: ['REST API', 'JSON responses'],
  nonFunctionalConstraints: ['scale to 1000 req/s'],
  skills: ['javascript', 'nodejs'],
  budget: { min: 0, max: 500, currency: 'USD' },
  // ... other context
};

const result = await evaluateTechnologyDecision(projectContext);
console.log(JSON.stringify(result, null, 2));
```

### Alternative Approach Considered

**Monolithic implementation**: Rejected - hard to maintain and test.

## Consequences

**Positive**:
- Clean separation of concerns
- Easy to test
- Extensible
- Maintainable

**Negative**:
- More files to manage
- Requires coordination
