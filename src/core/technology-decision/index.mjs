// L2: Technology Decision Engine
// Main entry point for the technology decision engine

export { evaluateTechnologyDecision } from './engine.mjs';
export {
  validateHardConstraints,
  calculateSoftConstraints,
  detectIncompatibilities,
  rankOptions
} from './analyzer-deterministic.mjs';
export {
  analyzeTradeoffs,
  assessRisks,
  compareArchitectures,
  documentUncertainties,
  generateExplanation
} from './analyzer-llm.mjs';
export {
  generateDecisionDocument,
  exportToJSON,
  exportToMarkdown
} from './generator.mjs';
