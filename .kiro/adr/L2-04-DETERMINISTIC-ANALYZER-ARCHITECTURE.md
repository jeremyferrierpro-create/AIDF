# L2-04: Deterministic Analyzer Architecture

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Need a deterministic, rule-based analyzer for technology option evaluation.

## Problem Statement

We need to:
1. Validate options against project constraints
2. Calculate constraint satisfaction scores
3. Identify incompatibilities
4. Produce transparent, auditable results

## Decision

Create a two-stage analyzer:

### Stage 1: Hard Constraint Validation

Eliminate options that fail hard constraints:
```javascript
export async function validateHardConstraints(options, projectContext) {
  const validOptions = [];
  const eliminated = [];
  
  for (const option of options) {
    const violations = [];
    
    // Budget check
    if (projectContext.budget && option.costs) {
      if (option.costs.estimatedCost > projectContext.budget.max) {
        violations.push({
          constraint: 'budget',
          optionValue: option.costs.estimatedCost,
          required: projectContext.budget.max,
          reason: `Option cost ${option.costs.estimatedCost} exceeds budget ${projectContext.budget.max}`
        });
      }
    }
    
    // Platform check
    if (projectContext.platform && option.platform) {
      const missing = projectContext.platform.filter(
        p => !option.platform.includes(p)
      );
      if (missing.length > 0) {
        violations.push({
          constraint: 'platform',
          optionValue: option.platform,
          required: projectContext.platform,
          reason: `Option platform ${option.platform} missing required: ${missing.join(', ')}`
        });
      }
    }
    
    // License check
    if (projectContext.license && option.license) {
      if (!projectContext.license.includes(option.license)) {
        violations.push({
          constraint: 'license',
          optionValue: option.license,
          required: projectContext.license,
          reason: `Option license ${option.license} not in acceptable list`
        });
      }
    }
    
    // Feature check
    if (projectContext.features && option.features?.required) {
      const missing = option.features.required.filter(
        f => !projectContext.features.includes(f)
      );
      if (missing.length > 0) {
        violations.push({
          constraint: 'features',
          optionValue: option.features.required,
          required: projectContext.features,
          reason: `Option missing required features: ${missing.join(', ')}`
        });
      }
    }
    
    if (violations.length === 0) {
      validOptions.push(option);
    } else {
      eliminated.push({ option: option.id, violations });
    }
  }
  
  return { validOptions, eliminated };
}
```

### Stage 2: Soft Constraint Scoring

Calculate satisfaction scores for remaining options:
```javascript
export function calculateSoftConstraints(options, projectContext) {
  return options.map(option => {
    const scores = {};
    
    // Skill match
    if (projectContext.skills && option.maintenance?.skillRequirements) {
      const skillCount = option.maintenance.skillRequirements.length;
      if (skillCount === 0) {
        scores.skillMatch = 1.0;
      } else {
        const matchingSkills = projectContext.skills.filter(s => 
          option.maintenance.skillRequirements.includes(s)
        );
        scores.skillMatch = matchingSkills.length / skillCount;
      }
    }
    
    // Ecosystem quality
    if (option.ecosystem?.documentationQuality) {
      const qualityMap = {
        'poor': 0.2,
        'fair': 0.4,
        'good': 0.7,
        'excellent': 1.0
      };
      scores.ecosystem = qualityMap[option.ecosystem.documentationQuality] || 0.5;
    }
    
    // Community size
    if (option.ecosystem?.communitySize) {
      const sizeMap = {
        'small': 0.3,
        'medium': 0.5,
        'large': 0.7,
        'huge': 1.0
      };
      scores.community = sizeMap[option.ecosystem.communitySize] || 0.5;
    }
    
    // Scalability match
    if (projectContext.scalability?.horizontal && option.scalability?.horizontal) {
      scores.scalability = 1.0;
    } else if (projectContext.scalability?.horizontal && !option.scalability?.horizontal) {
      scores.scalability = 0.2;
    } else {
      scores.scalability = 0.7;
    }
    
    return {
      option: option.id,
      scores,
      totalScore: Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
    };
  });
}
```

### Stage 3: Incompatibility Detection

Check for known incompatibilities:
```javascript
export function detectIncompatibilities(options) {
  const incompatibilities = [];
  
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const opt1 = options[i];
      const opt2 = options[j];
      
      const incompatible1 = opt1.compatibility?.incompatibleWith?.includes(opt2.id);
      const incompatible2 = opt2.compatibility?.incompatibleWith?.includes(opt1.id);
      
      if (incompatible1 || incompatible2) {
        incompatibilities.push({
          option1: opt1.id,
          option2: opt2.id,
          reason: incompatible1 
            ? opt1.compatibility.incompatibleWith.find(r => r.includes(opt2.id))
            : opt2.compatibility.incompatibleWith.find(r => r.includes(opt1.id))
        });
      }
    }
  }
  
  return incompatibilities;
}
```

### Stage 4: Final Ranking

Combine results:
```javascript
export function rankOptions(eliminated, scoredOptions, incompatibilities) {
  return {
    eliminated,
    shortlisted: scoredOptions.filter(s => s.totalScore >= 0.6),
    incompatible: incompatibilities,
    recommendations: generateRecommendations(scoredOptions, incompatibilities)
  };
}
```

## Input/Output

### Input
```javascript
{
  projectContext: {
    budget: { min: 0, max: 500, currency: 'USD' },
    platform: ['web', 'server'],
    license: ['MIT', 'Apache-2.0'],
    features: ['http', 'routing', 'middleware'],
    skills: ['javascript', 'nodejs'],
    scalability: { horizontal: true }
  },
  technologyOptions: [/* array of option definitions */]
}
```

### Output
```javascript
{
  summary: {
    totalOptions: 15,
    eliminated: 5,
    shortlisted: 3,
    incompatible: 2
  },
  details: {
    eliminated: [
      {
        option: 'option-a',
        violations: [/* violations array */]
      }
    ],
    shortlisted: [
      {
        option: 'option-b',
        scores: { skillMatch: 0.8, ecosystem: 0.9, community: 1.0, scalability: 1.0 },
        totalScore: 0.925
      }
    ],
    incompatible: [
      {
        option1: 'option-c',
        option2: 'option-d',
        reason: 'Version conflict'
      }
    ]
  }
}
```

## Alternative Approach Considered

**Decision matrix with weighted scores**: Rejected - too opaque, difficult to explain.

## Consequences

**Positive**:
- Transparent, auditable process
- Easy to explain decisions
- Deterministic results
- Handles both hard and soft constraints

**Negative**:
- Requires maintenance of option definitions
- May not capture nuanced trade-offs
- Some properties are subjective
