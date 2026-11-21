# L3-01: Design Engineering Overview

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: AIDF needs a design engineering engine that scales complexity with project requirements.

## Problem Statement

Current architecture lacks:
1. Adaptive design workflows based on project complexity
2. Visual parity validation between design and implementation
3. Accessible Figma integration (or graceful fallback)
4. Proportional design effort (small changes don't trigger full redesign)

## Decision

Create a Design Engineering Engine with:

### 1. Complexity Classifier
- Project size: small/medium/large/enterprise
- Feature complexity: simple/complex
- Team size: solo/small/large
- Timeline: quick/standard/extended
- **Output**: Design workflow profile

### 2. Adaptive Workflows
Based on complexity profile, select appropriate workflow:

**Small Project (Quick Release)**:
- User journey map
- Basic wireframes (HTML/SVG)
- Style guide
- Accessibility review

**Medium Project (Standard)**:
- User personas
- User flow diagrams
- Wireframes (Figma or HTML/SVG)
- Interactive prototype
- Design system (basic)

**Large Project (Extended)**:
- Complete UX research
- User testing
- High-fidelity mockups
- Comprehensive design system
- Accessibility audit
- Visual regression testing

### 3. Figma Integration (Conditional)
**Only if MCP Figma server is available and verified**:
- Validate: connection, identity, permissions
- Read: designs, components, assets
- Write: comments, proposals, updates
- Export: assets, specs

**Fallback if Figma unavailable**:
- Generate wireframes as HTML/SVG
- Generate mockups as versioned assets
- Generate screenshots of implementation
- Document fallback state clearly

### 4. Visual Parity
**Capture-based validation**:
- Reference capture (design)
- Implementation capture (actual)
- Diff analysis (automated)
- Human review (required for approval)
- **No score-based approval** - always require human sign-off

## Structure

```
src/core/design-engineering/
├── index.mjs
├── engine.mjs                  # Main orchestrator
├── complexity-classifier.mjs   # Project complexity assessment
├── workflows/                  # Workflow modules
│   ├── quick.mjs
│   ├── standard.mjs
│   └── extended.mjs
├── figma/                      # Figma integration
│   ├── client.mjs
│   └── validators.mjs
├── fallback/                   # Non-Figma outputs
│   ├── wireframes.mjs
│   ├── mockups.mjs
│   └── screenshots.mjs
└── visual-parity/              # Visual validation
    ├── capture.mjs
    ├── diff.mjs
    └── review.mjs
```

## Inputs

```json
{
  "projectId": "unique-id",
  "complexityProfile": {
    "projectSize": "small|medium|large|enterprise",
    "featureComplexity": "simple|complex",
    "teamSize": 1,
    "timeline": "quick|standard|extended"
  },
  "requirements": {
    "userStories": [...],
    "functionalSpec": {...},
    "nonFunctionalSpec": {...}
  },
  "figma": {
    "enabled": true,
    "fileId": "figma-file-id",
    "apiKey": "figma-api-key"
  },
  "visualParity": {
    "enabled": true,
    "referenceUrl": "http://localhost:3000/reference",
    "implementationUrl": "http://localhost:3000/actual"
  }
}
```

## Outputs

1. **Design Document**: Complete design specification
2. **Wireframes**: Figma or fallback format
3. **Mockups**: Versioned assets
4. **Visual Parity Report**: Comparison results
5. **Implementation Guide**: For developers

## Workflow Selection

```javascript
function selectWorkflow(complexityProfile) {
  if (complexityProfile.timeline === 'quick' || complexityProfile.teamSize === 1) {
    return 'quick';
  }
  if (complexityProfile.projectSize === 'small' || complexityProfile.teamSize <= 3) {
    return 'standard';
  }
  return 'extended';
}
```

## Figma Safety Checks

Before any Figma operation:
1. ✅ Connection test
2. ✅ Identity verification
3. ✅ Permission check (read/write as needed)
4. ✅ File existence validation

If any check fails, fall back to local generation.

## Visual Parity Process

1. Capture reference image (design)
2. Capture implementation image (code)
3. Generate diff (automated)
4. Human review (required)
5. Approval or revision cycle

**Never** use diff score as approval indicator.

## ADRs

- L3-01: Overview (this document)
- L3-02: Complexity Classification Rules
- L3-03: Design Workflows
- L3-04: Figma Integration Protocol
- L3-05: Fallback Generation
- L3-06: Visual Parity Protocol
