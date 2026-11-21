# L2-01: Technology Decision Engine Overview

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: AIDF needs a deterministic technology decision engine to help architects choose appropriate stacks based on project constraints.

## Problem Statement

Current architecture lacks a structured way to:
1. Analyze project constraints (functional, non-functional, business)
2. Evaluate technology options against constraints
3. Generate decisions with documented trade-offs
4. Support human arbitration for critical choices

## Decision

Create a Technology Decision Engine with two components:

### 1. Deterministic Analyzer (Rule-Based)
- Validates constraints and eliminates incompatible options
- Checks version compatibility and known incompatibilities
- Calculates constraint satisfaction scores (transparent metrics)
- Produces constraint violation reports

### 2. LLM Analyzer (Exploratory)
- Analyzes complex trade-offs not easily量化
- Compares architectural approaches
- Documents uncertainties and risks
- Generates narrative explanations

## Structure

```
src/core/technology-decision/
├── engine.mjs           # Main engine orchestrator
├── analyzer-deterministic.mjs  # Rule-based constraint checker
├── analyzer-llm.mjs     # LLM-based analysis
├── options/             # Technology option definitions
│   ├── databases.mjs
│   ├── frameworks.mjs
│   ├── servers.mjs
│   └── ...
├── constraints/         # Constraint definitions
│   ├── functional.mjs
│   ├── non-functional.mjs
│   └── business.mjs
└── generator.mjs        # Decision document generator
```

## Inputs

The engine accepts a project context object:
- `projectType`: 'web', 'api', 'mobile', 'desktop', 'embedded', 'iot', 'microservices'
- `businessGoals`: Array of business objectives
- `functionalConstraints`: Array of functional requirements
- `nonFunctionalConstraints`: Array of NFRs (performance, security, etc.)
- `skills`: Array of available team skills
- `budget`: Budget range (min, max, currency)
- `timeline`: Timeline constraints (weeks, milestones)
- `hosting`: Hosting constraints (cloud, on-prem, serverless)
- `data`: Data characteristics (volume, structure, consistency)
- `security`: Security requirements (compliance, encryption, auth)
- `load`: Expected load (users/req/s, peak traffic)
- `maintenance`: Maintenance capabilities
- `scalability`: Scalability requirements

## Outputs

Produces a decision document:
```json
{
  "projectId": "unique-id",
  "timestamp": "ISO8601",
  "context": { /* input context */ },
  "analysis": {
    "deterministic": { /* constraint satisfaction scores */ },
    "llm": { /* narrative analysis */ }
  },
  "options": {
    "shortlisted": [...],
    "eliminated": [
      {
        "option": "option-name",
        "reasons": ["reason1", "reason2"]
      }
    ]
  },
  "comparison": {
    "matrix": [...],
    "trade-offs": [...]
  },
  "recommendation": {
    "stack": [...],
    "confidence": "high|medium|low",
    "risks": [...],
    "uncertainties": [...]
  },
  "humanApproval": {
    "required": true,
    "approved": false,
    "comments": null
  }
}
```

## ADR Structure

Each decision produces an ADR file following AIDF's decision format.

## Alternatives Considered

1. **Score-based ranking**: Rejected - produces opaque scores that may mislead
2. **Pure LLM approach**: Rejected - lacks transparency and reproducibility
3. **Fixed stack per project type**: Rejected - too prescriptive, ignores context

## Consequences

**Positive**:
- Transparent decision process
- Supports human arbitration
- Produces auditable decisions
- Handles both simple and complex scenarios

**Negative**:
- Requires maintenance of option definitions
- LLM analysis adds latency
- May produce multiple viable options (harder to decide)

## Migration Strategy

1. Implement deterministic analyzer with basic options
2. Add LLM analyzer for complex trade-offs
3. Create sample decision documents
4. Validate with real-world project scenarios
