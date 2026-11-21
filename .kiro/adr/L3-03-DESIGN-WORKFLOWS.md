# L3-03: Design Workflows

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Need defined workflows for different design complexity levels.

## Decision

### Quick Workflow (Small/MVP Projects)

**Duration**: 1-3 days  
**Team**: 1-2 people  
**When**: Emergency releases, MVPs, maintenance updates

#### Steps

1. **User Journey Map** (2-4 hours)
   - Primary user flow
   - Key touchpoints
   - Pain points to address

2. **Basic Wireframes** (4-8 hours)
   - HTML/SVG fallback format
   - High-level layout
   - No visual polish

3. **Style Guide** (2-4 hours)
   - Color palette (3-5 colors)
   - Typography (1-2 fonts)
   - Basic components

4. **Accessibility Review** (1-2 hours)
   - Contrast check
   - Keyboard navigation
   - Screen reader compatibility

5. **Implementation Handoff** (2-4 hours)
   - Component breakdown
   - Markup patterns
   - CSS variables

**Deliverables**:
- User journey map (text/ diagram)
- Wireframes (HTML/SVG)
- Style guide (CSS)
- Accessibility report

### Standard Workflow (Medium Projects)

**Duration**: 1-2 weeks  
**Team**: 3-5 people  
**When**: Regular product development

#### Steps

1. **User Personas** (2-4 hours)
   - 2-3 primary personas
   - Goals, frustrations, behaviors

2. **User Flow Diagrams** (4-8 hours)
   - Main user journeys
   - Decision points
   - Error states

3. **Wireframes** (8-16 hours)
   - Figma (if available)
   - HTML/SVG (fallback)
   - All key screens

4. **Interactive Prototype** (8-16 hours)
   - Clickable prototype
   - Flow validation
   - User testing (optional)

5. **Design System (Basic)** (8-16 hours)
   - Component library
   - Usage guidelines
   - Documentation

6. **Accessibility Audit** (4-8 hours)
   - WCAG 2.1 AA check
   - Automated tests
   - Manual review

7. **Implementation Handoff** (4-8 hours)
   - Component specs
   - Design tokens
   - Code examples

**Deliverables**:
- User personas (Figma/ PDF)
- User flows (Figma/ diagram)
- Wireframes (Figma/ HTML/SVG)
- Prototype (Figma/ interactive)
- Design system (Figma/ docs)
- Accessibility report

### Extended Workflow (Large/Enterprise Projects)

**Duration**: 2-4+ weeks  
**Team**: 6-15+ people  
**When**: Major products, complex systems

#### Steps

1. **UX Research** (1-2 weeks)
   - User interviews
   - Surveys
   - Analytics review
   - Competitive analysis

2. **User Testing** (1 week)
   - Usability testing
   - A/B testing
   - Feedback collection

3. **High-Fidelity Mockups** (1-2 weeks)
   - Complete visual design
   - All states and variations
   - Animations and interactions

4. **Design System (Comprehensive)** (1-2 weeks)
   - Complete component library
   - Design tokens (colors, typography, spacing)
   - Guidelines and patterns
   - Documentation

5. **Accessibility Audit** (1 week)
   - WCAG 2.1 AAA check
   - Automated tests
   - Manual testing
   - Assistive tech testing

6. **Visual Regression Suite** (1 week)
   - Reference captures
   - Diff thresholds
   - Test automation

7. **Implementation Handoff** (1 week)
   - Detailed specs
   - Component patterns
   - Code examples
   - Migration guide

**Deliverables**:
- Research report
- Test results
- High-fidelity mockups (Figma)
- Design system (Figma/ docs)
- Accessibility report
- Visual regression suite
- Implementation guide

## Workflow Selection

```javascript
export function getWorkflow(complexity) {
  switch (complexity) {
    case 'small':
    case 'quick':
    case 'mvp':
      return 'quick';
    case 'medium':
      return 'standard';
    case 'large':
    case 'enterprise':
      return 'extended';
    default:
      return 'standard';
  }
}
```

## Fallback Strategy

If Figma is unavailable for Standard or Extended workflows:
- Generate HTML/SVG wireframes
- Generate CSS-based mockups
- Document limitations clearly
- Proceed with implementation

## Progression

A project can start with Quick workflow and progress to Standard or Extended as requirements evolve.

## Emergency Protocol

For emergency releases:
1. Skip all non-critical steps
2. Focus on accessibility
3. Document all compromises
4. Schedule follow-up review

## Alternative Approach Considered

**Linear workflow for all projects**: Rejected - doesn't scale appropriately.

## Consequences

**Positive**:
- Clear expectations for each complexity level
- Scalable effort
- Emergency overrides available
- Clear fallback strategy

**Negative**:
- May need customization for unique projects
- Some steps may overlap
