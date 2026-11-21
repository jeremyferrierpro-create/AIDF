# L2-06: Decision Document Format

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Need standardized format for technology decision documents.

## Problem Statement

Decision documents need to:
1. Capture all relevant information
2. Support auditability
3. Enable human review and approval
4. Serve as ADR (Architecture Decision Record)

## Decision

Use a JSON-based decision document format:

```json
{
  "meta": {
    "version": "1.0.0",
    "id": "TECH-DECISION-2026-001",
    "projectId": "unique-project-id",
    "timestamp": "2026-11-20T10:00:00.000Z",
    "author": "Kiro",
    "status": "draft|approved|rejected|deprecated"
  },
  "context": {
    "projectType": "web",
    "businessGoals": ["fast time-to-market", "low cost"],
    "functionalConstraints": ["REST API", "JSON responses"],
    "nonFunctionalConstraints": ["scale to 1000 req/s", "99.9% uptime"],
    "skills": ["javascript", "nodejs"],
    "budget": { "min": 0, "max": 500, "currency": "USD" },
    "timeline": { "weeks": 12, "milestones": ["M1", "M2"] },
    "hosting": "aws",
    "data": { "volume": "small", "consistency": "strong" },
    "security": { "compliance": "none", "encryption": "required" },
    "load": { "users": 10000, "reqPerSecond": 100 },
    "maintenance": { "teamSize": 2, "expertise": "backend" },
    "scalability": { "horizontal": true, "maxUsers": 100000 }
  },
  "analysis": {
    "deterministic": {
      "summary": {
        "totalOptions": 15,
        "validOptions": 8,
        "shortlistedOptions": 3,
        "eliminatedOptions": 5
      },
      "constraints": {
        "satisfied": [
          { "constraint": "budget", "value": 100, "threshold": 500 }
        ],
        "violated": [
          { "constraint": "platform", "value": "mobile-only", "required": ["web", "server"] }
        ]
      },
      "options": [
        {
          "option": "express",
          "satisfaction": { "hard": 1.0, "soft": 0.85, "total": 0.925 }
        }
      ]
    },
    "llm": {
      "tradeoffs": [
        {
          "option1": "express",
          "option2": "fastify",
          "analysis": "Express has larger community, Fastify has better performance"
        }
      ],
      "risks": [
        {
          "component": "express",
          "risk": "Mature but slower performance",
          "impact": "medium",
          "mitigation": "Use compression middleware, caching"
        }
      ],
      "uncertainties": [
        {
          "component": "express",
          "unknown": "Long-term maintenance costs",
          "confidence": "medium"
        }
      ]
    }
  },
  "options": {
    "shortlisted": [
      {
        "id": "express",
        "name": "Express.js",
        "reason": "High skill match, good ecosystem, within budget"
      },
      {
        "id": "fastify",
        "name": "Fastify",
        "reason": "Better performance, good ecosystem"
      }
    ],
    "eliminated": [
      {
        "id": "spring-boot",
        "name": "Spring Boot",
        "reason": "Java skill gap in team, higher budget requirements"
      },
      {
        "id": "aws-lambda",
        "name": "AWS Lambda",
        "reason": "Vendor lock-in concerns"
      }
    ],
    "incompatible": [
      {
        "option1": "option-a",
        "option2": "option-b",
        "reason": "Version conflict"
      }
    ]
  },
  "comparison": {
    "matrix": [
      {
        "criteria": "cost",
        "express": "$100/month",
        "fastify": "$50/month",
        "winner": "fastify"
      },
      {
        "criteria": "performance",
        "express": "5000 req/s",
        "fastify": "15000 req/s",
        "winner": "fastify"
      },
      {
        "criteria": "ecosystem",
        "express": "large",
        "fastify": "medium",
        "winner": "express"
      }
    ],
    "trade-offs": [
      "Express has larger ecosystem but lower performance",
      "Fastify has better performance but smaller ecosystem"
    ]
  },
  "recommendation": {
    "stack": [
      {
        "component": "framework",
        "option": "express",
        "version": "4.18.0",
        "reason": "Best balance of ecosystem, cost, and team skills"
      },
      {
        "component": "database",
        "option": "postgres",
        "version": "15.0",
        "reason": "Open source, reliable, fits budget"
      }
    ],
    "confidence": "medium",
    "risks": [
      {
        "risk": "Performance may not scale to 10000 req/s",
        "probability": "medium",
        "impact": "high",
        "mitigation": "Use caching, optimize queries, consider Fastify if scaling issues arise"
      }
    ],
    "uncertainties": [
      {
        "uncertainty": "Real-world performance with expected traffic",
        "confidence": "medium",
        "mitigation": "Load testing before production"
      }
    ],
    "suggested-tests": [
      "Performance benchmark with expected traffic",
      "Security audit of Express ecosystem",
      "Team skill assessment for Express maintenance"
    ]
  },
  "humanApproval": {
    "required": true,
    "approved": false,
    "approver": null,
    "comments": null,
    "timestamp": null
  }
}
```

## Document Structure

### 1. Meta Section
- Version control for the document
- Project context
- Status tracking

### 2. Context Section
- Complete project description
- All constraints and requirements
- Input to the decision process

### 3. Analysis Section
- Deterministic analysis results
- LLM analysis results
- Constraint satisfaction

### 4. Options Section
- Shortlisted options with reasons
- Eliminated options with reasons
- Incompatibilities

### 5. Comparison Section
- Side-by-side comparison
- Trade-offs documented

### 6. Recommendation Section
- Proposed stack
- Confidence level
- Risks and uncertainties
- Suggested tests

### 7. Human Approval Section
- Approval status
- Approver information
- Comments

## ADR Integration

The decision document is stored as an ADR:
```
.aidf/decisions/
├── TECH-2026-001-framework-selection.md
├── TECH-2026-002-database-selection.md
└── ...
```

## Alternative Approach Considered

**Markdown-only format**: Rejected - difficult to parse and process programmatically.

## Consequences

**Positive**:
- Standardized format
- Easy to parse
- Supports auditability
- Includes all relevant information

**Negative**:
- More complex than simple ADR
- Requires validation
- May be overkill for simple decisions
