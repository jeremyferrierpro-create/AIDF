# L2-02: Constraint Validation Rules

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Need deterministic rules to validate technology options against project constraints.

## Problem Statement

When evaluating technology options, we need to:
1. Eliminate options that violate hard constraints
2. Identify incompatible combinations
3. Calculate satisfaction levels for soft constraints
4. Provide clear reasons for eliminations

## Decision

Define a constraint validation system with three tiers:

### 1. Hard Constraints (Must-Satisfy)
These constraints eliminate options if not met:
- `minRequirements`: Option must provide ALL required features
- `maxRequirements`: Option must NOT provide forbidden features
- `budget`: Option cost must be within budget
- `license`: License type must be acceptable
- `platform`: Platform must be supported

### 2. Soft Constraints (Should-Satisfy)
These affect scoring but don't eliminate:
- `performance`: Match performance expectations
- `skillMatch`: Team skills align with option requirements
- `maintenance`: Maintenance complexity acceptable
- `ecosystem`: Ecosystem maturity

### 3. Soft Constraints (Could-Satisfy)
These provide minor weighting:
- `community`: Community size
- `documentation`: Documentation quality
- `trend`: Technology trend alignment

## Constraint Definitions

```javascript
export const CONSTRAINT_TYPES = {
  HARD: 'hard',
  SOFT: 'soft',
  COULD: 'could'
};

export const HARD_CONSTRAINTS = {
  MIN_FEATURES: 'minFeatures',
  MAX_FEATURES: 'maxFeatures',
  BUDGET: 'budget',
  LICENSE: 'license',
  PLATFORM: 'platform',
  COMPLIANCE: 'compliance'
};

export const SOFT_CONSTRAINTS = {
  PERFORMANCE: 'performance',
  SKILL_MATCH: 'skillMatch',
  MAINTENANCE: 'maintenance',
  ECOSYSTEM: 'ecosystem'
};

export const COULD_CONSTRAINTS = {
  COMMUNITY: 'community',
  DOCUMENTATION: 'documentation',
  TREND: 'trend'
};
```

## Validation Logic

### Elimination Rule
An option is eliminated if:
- Any hard constraint is NOT satisfied
- Any incompatibility is detected

### Scoring Rule
Soft constraint satisfaction contributes to option score:
```
score = Σ(softConstraintWeight * softConstraintSatisfaction)
```

### Transparency Rule
All eliminations must include:
1. The constraint that was violated
2. The option's response to that constraint
3. Clear reasoning in natural language

## Example Constraints

### Budget Constraint
```javascript
{
  type: 'hard',
  constraint: 'budget',
  value: { min: 0, max: 5000, currency: 'USD' },
  optionImpact: {
    free: 'satisfied',
    paid: 'partiallySatisfied',
    enterprise: 'notSatisfied'
  }
}
```

### Platform Constraint
```javascript
{
  type: 'hard',
  constraint: 'platform',
  value: ['web', 'mobile'],
  optionImpact: {
    webOnly: 'notSatisfied',
    multiPlatform: 'satisfied'
  }
}
```

## Incompatibility Detection

Define known incompatibilities:
```javascript
export const INCOMPATIBILITIES = [
  {
    options: ['option-a', 'option-b'],
    reason: 'Version conflict between Option A v2.x and Option B v1.x'
  },
  {
    options: ['option-c', 'option-d'],
    reason: 'License incompatibility: GPL vs Proprietary'
  }
];
```

## Alternative Approach Considered

**Rule-based expert system**: Rejected - too complex for current needs.

## Consequences

**Positive**:
- Clear, auditable decision process
- Easy to explain eliminations
- Handles both simple and complex constraints

**Negative**:
- Requires maintenance of constraint definitions
- May not capture nuanced trade-offs
