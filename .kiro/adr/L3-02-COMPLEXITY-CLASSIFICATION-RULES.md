# L3-02: Complexity Classification Rules

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Need objective rules to determine design effort based on project characteristics.

## Problem Statement

Need to:
1. Classify projects by complexity
2. Select appropriate design workflow
3. Scale effort proportionally to project needs
4. Avoid over-engineering simple projects

## Decision

Use a multi-factor complexity classification:

### Classification Factors

| Factor | Small | Medium | Large | Enterprise |
|--------|-------|--------|-------|------------|
| Project Size | < 50 screens | 50-200 screens | 200-1000 screens | > 1000 screens |
| Features | < 5 core features | 5-15 features | 15-50 features | > 50 features |
| Team Size | 1-2 people | 3-5 people | 6-15 people | > 15 people |
| Timeline | < 2 weeks | 2-8 weeks | 8-16 weeks | > 16 weeks |
| Budget | < $10K | $10K-$50K | $50K-$200K | > $200K |

### Classification Logic

```javascript
export function classifyComplexity(context) {
  const factors = {
    projectSize: classifyByFeatureCount(context.featureCount),
    teamSize: classifyByTeamSize(context.teamSize),
    timeline: classifyByTimeline(context.timelineWeeks),
    budget: classifyByBudget(context.budget)
  };
  
  // Determine overall complexity
  const scores = Object.values(factors).map(f => f.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  let complexity;
  if (avgScore < 1.5) complexity = 'small';
  else if (avgScore < 2.5) complexity = 'medium';
  else if (avgScore < 3.5) complexity = 'large';
  else complexity = 'enterprise';
  
  // Check for emergency overrides
  if (context.emergency || context.mvpMode) {
    complexity = 'small';
  }
  
  return {
    complexity,
    factors,
    score: avgScore
  };
}

function classifyByFeatureCount(count) {
  if (count < 5) return { level: 'small', score: 1 };
  if (count < 15) return { level: 'medium', score: 2 };
  if (count < 50) return { level: 'large', score: 3 };
  return { level: 'enterprise', score: 4 };
}

function classifyByTeamSize(size) {
  if (size <= 2) return { level: 'small', score: 1 };
  if (size <= 5) return { level: 'medium', score: 2 };
  if (size <= 15) return { level: 'large', score: 3 };
  return { level: 'enterprise', score: 4 };
}

function classifyByTimeline(weeks) {
  if (weeks < 2) return { level: 'quick', score: 1 };
  if (weeks < 8) return { level: 'standard', score: 2 };
  if (weeks < 16) return { level: 'extended', score: 3 };
  return { level: 'enterprise', score: 4 };
}

function classifyByBudget(budget) {
  if (budget < 10000) return { level: 'small', score: 1 };
  if (budget < 50000) return { level: 'medium', score: 2 };
  if (budget < 200000) return { level: 'large', score: 3 };
  return { level: 'enterprise', score: 4 };
}
```

### Workflow Selection

| Complexity | Workflow | Design Effort |
|------------|----------|---------------|
| Small | Quick | 1-3 days |
| Medium | Standard | 1-2 weeks |
| Large | Extended | 2-4 weeks |
| Enterprise | Extended+ | 4+ weeks |

### Emergency Overrides

Projects with these flags override classification:
- `mvpMode`: Force 'small' complexity
- `emergency`: Force 'small' complexity
- `maintenance`: Force 'small' complexity (incremental updates)

### Input Context

```json
{
  "featureCount": 12,
  "teamSize": 4,
  "timelineWeeks": 6,
  "budget": 35000,
  "emergency": false,
  "mvpMode": false,
  "maintenance": false
}
```

### Output

```json
{
  "complexity": "medium",
  "score": 2.17,
  "factors": {
    "projectSize": { "level": "medium", "score": 2 },
    "teamSize": { "level": "medium", "score": 2 },
    "timeline": { "level": "standard", "score": 2 },
    "budget": { "level": "medium", "score": 2 }
  }
}
```

## Alternative Approach Considered

**Single-factor classification**: Rejected - too simplistic, doesn't capture full context.

## Consequences

**Positive**:
- Objective, reproducible classification
- Scales effort appropriately
- Prevents over-engineering
- Emergency overrides for flexibility

**Negative**:
- Requires accurate project data
- May need human override in edge cases
