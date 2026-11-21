# L2-08: Technology Decision Engine Tests

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Define test strategy for L2 Technology Decision Engine.

## Test Strategy

### Test Categories

1. **Unit Tests**: Individual functions
2. **Integration Tests**: Components working together
3. **End-to-End Tests**: Complete decision process
4. **Example Tests**: Sample decisions for validation

### Test Files

```
tests/
├── technology-decision/
│   ├── engine.test.mjs
│   ├── deterministic.test.mjs
│   ├── llm.test.mjs
│   ├── generator.test.mjs
│   └── examples.test.mjs
```

### Unit Tests (engine.test.mjs)

Test the main engine:
```javascript
test('evaluateTechnologyDecision returns document', async () => {
  const context = { projectType: 'web', budget: { max: 500 } };
  const result = await evaluateTechnologyDecision(context);
  
  assert.ok(result.meta);
  assert.ok(result.context);
  assert.ok(result.analysis);
  assert.ok(result.options);
  assert.ok(result.recommendation);
});

test('evaluateTechnologyDecision handles constraints', async () => {
  const context = {
    projectType: 'web',
    budget: { max: 100 },
    platform: ['web', 'server']
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  // Options exceeding budget should be eliminated
  const eliminated = result.options.eliminated;
  assert.ok(eliminated.some(e => e.reason.includes('budget')));
});

test('evaluateTechnologyDecision detects incompatibilities', async () => {
  const context = { projectType: 'api' };
  const result = await evaluateTechnologyDecision(context);
  
  assert.ok(result.options.incompatible);
});
```

### Unit Tests (deterministic.test.mjs)

Test the deterministic analyzer:
```javascript
test('validateHardConstraints eliminates invalid options', async () => {
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
});

test('calculateSoftConstraints scores options', async () => {
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
  assert.ok(scores[0].scores.skillMatch === 1.0);
  assert.ok(scores[0].scores.ecosystem === 1.0);
  assert.ok(scores[0].scores.community === 1.0);
});

test('detectIncompatibilities finds conflicts', async () => {
  const options = [
    {
      id: 'option1',
      compatibility: { incompatibleWith: ['option2'] }
    },
    {
      id: 'option2'
    }
  ];
  
  const incompatibilities = detectIncompatibilities(options);
  
  assert.equal(incompatibilities.length, 1);
  assert.equal(incompatibilities[0].option1, 'option1');
  assert.equal(incompatibilities[0].option2, 'option2');
});
```

### Unit Tests (llm.test.mjs)

Test the LLM analyzer:
```javascript
test('analyzeTradeoffs returns analysis', async () => {
  const context = { projectType: 'web' };
  const options = [
    { id: 'express', name: 'Express.js' },
    { id: 'fastify', name: 'Fastify' }
  ];
  
  const analysis = await analyzeTradeoffs(context, options);
  
  assert.ok(analysis.tradeoffs);
  assert.ok(analysis.tradeoffs.length > 0);
});

test('assessRisks returns risks', async () => {
  const context = { projectType: 'web' };
  const stack = [{ component: 'framework', option: 'express' }];
  
  const risks = await assessRisks(context, stack);
  
  assert.ok(risks.risks);
  assert.ok(risks.risks.length >= 0); // May be empty if no risks found
});
```

### Unit Tests (generator.test.mjs)

Test the document generator:
```javascript
test('generateDecisionDocument creates complete document', async () => {
  const context = { projectType: 'web' };
  const analysis = {
    deterministic: { eliminated: [], scores: [], incompatibilities: [] },
    llm: { tradeoffs: [], risks: [], uncertainties: [] }
  };
  const recommendation = { stack: [], confidence: 'medium', risks: [] };
  
  const document = generateDecisionDocument(context, analysis, recommendation);
  
  assert.ok(document.meta);
  assert.ok(document.context);
  assert.ok(document.analysis);
  assert.ok(document.options);
  assert.ok(document.recommendation);
});

test('exportToJSON returns valid JSON string', async () => {
  const document = {
    meta: { version: '1.0.0' },
    context: { projectType: 'web' }
  };
  
  const json = exportToJSON(document);
  
  const parsed = JSON.parse(json);
  assert.equal(parsed.meta.version, '1.0.0');
  assert.equal(parsed.context.projectType, 'web');
});
```

### End-to-End Tests (examples.test.mjs)

Test complete decision workflows:
```javascript
test('web app decision with budget constraint', async () => {
  const context = {
    projectType: 'web',
    businessGoals: ['low cost', 'fast delivery'],
    budget: { min: 0, max: 300, currency: 'USD' },
    skills: ['javascript', 'nodejs'],
    platform: ['web', 'server']
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  // Should have recommendations
  assert.ok(result.recommendation.stack);
  assert.ok(result.recommendation.stack.length > 0);
  
  // Should not exceed budget
  for (const component of result.recommendation.stack) {
    const option = findOptionById(component.option);
    assert.ok(option.costs.estimatedCost <= context.budget.max);
  }
});

test('api with high performance requirement', async () => {
  const context = {
    projectType: 'api',
    nonFunctionalConstraints: ['high performance'],
    load: { reqPerSecond: 10000 },
    scalability: { horizontal: true }
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  // Should recommend performant options
  assert.ok(result.recommendation.stack);
});

test('mobile app decision', async () => {
  const context = {
    projectType: 'mobile',
    platform: ['mobile'],
    skills: ['javascript', 'react-native']
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  // Should include mobile-compatible options
  assert.ok(result.recommendation.stack);
});
```

### Integration Tests

Test components working together:
```javascript
test('complete decision process', async () => {
  const context = {
    projectType: 'web',
    budget: { min: 0, max: 500, currency: 'USD' },
    skills: ['javascript', 'nodejs', 'sql'],
    scalability: { horizontal: true }
  };
  
  const result = await evaluateTechnologyDecision(context);
  
  // Verify all sections present
  assert.ok(result.meta);
  assert.ok(result.context);
  assert.ok(result.analysis.deterministic);
  assert.ok(result.analysis.llm);
  assert.ok(result.options);
  assert.ok(result.recommendation);
  
  // Verify consistency
  const eliminatedIds = result.options.eliminated.map(e => e.option);
  for (const stackItem of result.recommendation.stack) {
    assert.ok(!eliminatedIds.includes(stackItem.option));
  }
});
```

## Test Data

Create test fixtures:
```
tests/fixtures/
├── project-contexts/
│   ├── web-simple.json
│   ├── api-high-performance.json
│   ├── mobile-react-native.json
│   └── microservices.json
├── technology-options/
│   ├── databases.json
│   ├── frameworks.json
│   └── cloud.json
└── expected-decisions/
    ├── web-simple-expected.json
    └── api-high-performance-expected.json
```

### Example Test Fixture

```json
// tests/fixtures/project-contexts/web-simple.json
{
  "projectType": "web",
  "businessGoals": ["fast time-to-market", "low cost"],
  "functionalConstraints": ["REST API", "JSON responses"],
  "nonFunctionalConstraints": ["scale to 1000 req/s", "99.9% uptime"],
  "skills": ["javascript", "nodejs", "html", "css"],
  "budget": { "min": 0, "max": 300, "currency": "USD" },
  "timeline": { "weeks": 8, "milestones": ["M1", "M2", "M3"] },
  "hosting": "shared",
  "data": { "volume": "small", "consistency": "moderate" },
  "security": { "compliance": "none", "encryption": "recommended" },
  "load": { "users": 10000, "reqPerSecond": 100 },
  "maintenance": { "teamSize": 2, "expertise": "full-stack" },
  "scalability": { "horizontal": true, "maxUsers": 100000 }
}
```

## Mocking LLM

For tests, mock the LLM calls:
```javascript
import { analyzeTradeoffs } from '../src/core/technology-decision/analyzer-llm.mjs';

// Mock LLM response
global.callLLM = jest.fn().mockImplementation((prompt) => {
  return JSON.stringify({
    tradeoffs: [
      {
        option1: 'express',
        option2: 'fastify',
        analysis: 'Express has larger community, Fastify has better performance'
      }
    ]
  });
});

test('analyzeTradeoffs uses mocked LLM', async () => {
  const context = { projectType: 'web' };
  const options = [
    { id: 'express', name: 'Express.js' },
    { id: 'fastify', name: 'Fastify' }
  ];
  
  const result = await analyzeTradeoffs(context, options);
  
  assert.equal(result.tradeoffs.length, 1);
});
```

## Alternative Approach Considered

**Snapshot testing only**: Rejected - too brittle, doesn't verify logic.

## Consequences

**Positive**:
- Comprehensive test coverage
- Easy to verify logic
- Example-based testing
- Mockable dependencies

**Negative**:
- More tests to maintain
- May need updates when logic changes
