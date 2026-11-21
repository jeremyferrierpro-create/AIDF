import { validateHardConstraints, calculateSoftConstraints, detectIncompatibilities, rankOptions } from './analyzer-deterministic.mjs';
import { analyzeTradeoffs, assessRisks, documentUncertainties, generateExplanation } from './analyzer-llm.mjs';
import { generateDecisionDocument, exportToJSON, exportToMarkdown } from './generator.mjs';

/**
 * Evaluate technology decision based on project context.
 * Returns a complete decision document.
 */
export async function evaluateTechnologyDecision(projectContext, options = {}) {
  const context = {
    projectType: projectContext.projectType,
    businessGoals: projectContext.businessGoals || [],
    functionalConstraints: projectContext.functionalConstraints || [],
    nonFunctionalConstraints: projectContext.nonFunctionalConstraints || [],
    skills: projectContext.skills || [],
    budget: projectContext.budget,
    timeline: projectContext.timeline,
    platform: projectContext.platform || [],
    license: projectContext.license || [],
    features: projectContext.features || [],
    compliance: projectContext.compliance || [],
    scalability: projectContext.scalability
  };
  
  // Step 1: Validate hard constraints
  const { validOptions, eliminated } = await validateHardConstraints(
    options.technologyOptions || [],
    context
  );
  
  // Step 2: Calculate soft constraints
  const scores = calculateSoftConstraints(validOptions, context);
  
  // Step 3: Detect incompatibilities
  const incompatibilities = detectIncompatibilities(validOptions);
  
  // Step 4: Rank options
  const ranked = rankOptions(validOptions, scores, incompatibilities);
  
  // Step 5: Get LLM analysis (only for shortlisted options)
  const llmAnalysis = await getLLMAnalysis(context, ranked);
  
  // Step 6: Generate recommendation
  const recommendation = generateRecommendation(ranked, llmAnalysis);
  
  // Step 7: Generate document
  const document = generateDecisionDocument(context, {
    deterministic: {
      summary: {
        totalOptions: options.technologyOptions?.length || 0,
        validOptions: validOptions.length,
        shortlistedOptions: ranked.shortlisted?.length || 0,
        eliminatedOptions: eliminated.length
      },
      eliminated,
      scores,
      incompatibilities
    },
    llm: llmAnalysis
  }, recommendation);
  
  return document;
}

/**
 * Get LLM analysis for shortlisted options.
 */
async function getLLMAnalysis(context, ranked) {
  const analysis = {
    tradeoffs: [],
    risks: [],
    uncertainties: [],
    architecture: []
  };
  
  // Only analyze if we have shortlisted options
  if (ranked.shortlisted && ranked.shortlisted.length > 0) {
    // Get top 3 shortlisted options for analysis
    const topOptions = ranked.shortlisted.slice(0, 3).map(s => 
      ranked.shortlisted.find(o => o.option === s.option) || { id: s.option }
    );
    
    // Analyze trade-offs between top options
    if (topOptions.length >= 2) {
      analysis.tradeoffs = await analyzeTradeoffs(context, topOptions);
    }
    
    // Assess risks for recommended stack
    const stack = ranked.shortlisted.slice(0, 2).map(s => ({
      component: 'primary',
      option: s.option
    }));
    analysis.risks = await assessRisks(context, stack);
    
    // Document uncertainties
    const uncertaintiesResult = await documentUncertainties(context, stack);
    analysis.uncertainties = uncertaintiesResult.uncertainties;
    
    // Get architecture comparison if multiple approaches exist
    if (ranked.shortlisted.length >= 2) {
      analysis.architecture = await compareArchitectures(
        context,
        ranked.shortlisted.map(s => ({ name: s.option, complexity: 'medium' }))
      );
    }
  }
  
  return analysis;
}

/**
 * Generate recommendation from analysis results.
 */
function generateRecommendation(ranked, llmAnalysis) {
  if (!ranked.shortlisted || ranked.shortlisted.length === 0) {
    return {
      stack: [],
      confidence: 'low',
      risks: ['No viable options found'],
      uncertainties: [],
      suggestedTests: []
    };
  }
  
  // Get top option as recommendation
  const topOption = ranked.shortlisted[0];
  
  // Build stack
  const stack = [
    {
      component: 'primary',
      option: topOption.option,
      version: '1.0.0', // Would be filled from option definition
      reason: `Highest score: ${topOption.totalScore.toFixed(2)}`
    }
  ];
  
  // Add risks from LLM analysis
  const risks = llmAnalysis.risks || [];
  
  // Add uncertainties from LLM analysis
  const uncertainties = llmAnalysis.uncertainties || [];
  
  // Determine confidence based on scores and uncertainties
  let confidence = 'medium';
  if (topOption.totalScore >= 0.8 && uncertainties.length === 0) {
    confidence = 'high';
  } else if (topOption.totalScore < 0.6) {
    confidence = 'low';
  }
  
  return {
    stack,
    confidence,
    risks: risks.map(r => ({
      risk: r.vulnerabilities?.join(', ') || r.description || 'Unknown risk',
      impact: 'medium',
      mitigation: r.mitigation?.join(', ')
    })),
    uncertainties: uncertainties.map(u => ({
      component: u.component,
      uncertainty: u.unknowns?.join(', ') || 'Unknown'
    })),
    suggestedTests: [
      `Performance benchmark for ${topOption.option}`,
      `Security audit for ${topOption.option}`,
      `Team skill assessment for ${topOption.option}`
    ]
  };
}

/**
 * Compare architectures (placeholder for LLM analysis).
 */
async function compareArchitectures(context, architectures) {
  return [];
}
