# L2-05: LLM Analyzer Prompts

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Need LLM prompts for complex trade-off analysis and risk assessment.

## Problem Statement

LLM is needed for:
1. Analyzing complex trade-offs not easily量化
2. Comparing architectural approaches
3. Documenting uncertainties and risks
4. Generating narrative explanations

## Decision

Use a modular prompt system with different prompts for different tasks:

### Prompt 1: Trade-off Analysis
```
You are an expert software architect. Analyze the trade-offs between the following technology options.

Project Context:
{{PROJECT_CONTEXT}}

Technology Options:
{{OPTIONS}}

For each pair of options, explain:
1. The key trade-off (performance vs cost, complexity vs features, etc.)
2. Which option is better for which use case
3. The long-term implications of each choice

Format your response as JSON:
{
  "tradeoffs": [
    {
      "option1": "option-id-1",
      "option2": "option-id-2",
      "tradeOff": "explanation",
      "recommendation": "which option for which scenario"
    }
  ]
}
```

### Prompt 2: Risk Assessment
```
You are a cybersecurity expert. Assess the security risks of the following technology stack.

Project Context:
{{PROJECT_CONTEXT}}

Proposed Stack:
{{STACK}}

For each component and the overall stack, identify:
1. Security vulnerabilities
2. Compliance concerns (GDPR, HIPAA, etc.)
3. Attack surface
4. Mitigation strategies

Format your response as JSON:
{
  "risks": [
    {
      "component": "component-name",
      "vulnerabilities": ["vuln1", "vuln2"],
      "compliance": ["gdpr", "hipaa"],
      "attackSurface": ["entry1", "entry2"],
      "mitigation": ["mitigation1", "mitigation2"]
    }
  ]
}
```

### Prompt 3: Architecture Comparison
```
You are an enterprise architect. Compare the following architectural approaches.

Project Context:
{{PROJECT_CONTEXT}}

Architecture Options:
{{ARCHITECTURES}}

For each option, evaluate:
1. Development complexity
2. Team requirements
3. Maintenance burden
4. Cost over time
5. Innovation velocity

Format your response as JSON:
{
  "architectures": [
    {
      "name": "architecture-name",
      "complexity": "low|medium|high",
      "teamRequirements": ["skill1", "skill2"],
      "maintenanceBurden": "low|medium|high",
      "costOverTime": "low|medium|high",
      "innovationVelocity": "slow|moderate|fast"
    }
  ]
}
```

### Prompt 4: Uncertainty Documentation
```
You are a project manager. Identify the key uncertainties in the following technology decision.

Project Context:
{{PROJECT_CONTEXT}}

Proposed Stack:
{{STACK}}

For each component and the overall decision, identify:
1. Unknowns (things we don't know)
2. Unknown unknowns (things we don't know we don't know)
3. Dependencies on external factors
4. Assumptions being made

Format your response as JSON:
{
  "uncertainties": [
    {
      "component": "component-name",
      "unknowns": ["unknown1", "unknown2"],
      "unknownUnknowns": ["unknownUnknown1"],
      "externalDependencies": ["dep1", "dep2"],
      "assumptions": ["assumption1", "assumption2"]
    }
  ],
  "confidence": "high|medium|low"
}
```

### Prompt 5: Explanation Generator
```
You are a technical writer. Explain the technology decision to stakeholders.

Project Context:
{{PROJECT_CONTEXT}}

Technology Options:
{{OPTIONS}}

Decision Made:
{{DECISION}}

Explain:
1. What was considered
2. Why this option was chosen
3. What trade-offs were made
4. What risks remain
5. What would cause reconsideration

Format your response as JSON:
{
  "considered": ["option1", "option2"],
  "chosen": "option3",
  "reason": "explanation",
  "tradeoffs": ["tradeoff1", "tradeoff2"],
  "risks": ["risk1", "risk2"],
  "reconsideration": ["condition1", "condition2"]
}
```

## Implementation Strategy

1. Create a `llm-analyzer.mjs` module with prompt templates
2. Use environment variable `AI_MODEL` to select model
3. Cache LLM responses to avoid redundant calls
4. Fall back gracefully if AI is unavailable

### Example Implementation
```javascript
export async function analyzeTradeoffs(projectContext, options, model = process.env.AI_MODEL) {
  const prompt = templates.tradeoffAnalysis(projectContext, options);
  
  try {
    const response = await callLLM(prompt, model);
    return JSON.parse(response);
  } catch (error) {
    console.warn('LLM tradeoff analysis failed:', error.message);
    return { tradeoffs: [] };
  }
}
```

## Alternative Approach Considered

**Fixed analysis templates**: Rejected - too rigid, doesn't adapt to context.

## Consequences

**Positive**:
- Flexible, context-aware analysis
- Human-readable explanations
- Covers complex trade-offs
- Documents uncertainties

**Negative**:
- LLM-dependent (cost, availability)
- Results may vary between runs
- May hallucinate information
- Adds latency to analysis
