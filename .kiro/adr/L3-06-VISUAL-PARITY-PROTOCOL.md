# L3-06: Visual Parity Protocol

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Visual comparison between design and implementation requires human validation.

## Decision

### Visual Parity Process

**Step 1: Capture Reference (Design)**
```javascript
export async function captureReference(designSource, options = {}) {
  // If Figma: capture from Figma
  if (designSource.type === 'figma') {
    const image = await figma.getImage(designSource.fileId, designSource.nodeId);
    return {
      type: 'reference',
      source: designSource,
      imageData: image,
      timestamp: new Date().toISOString()
    };
  }
  
  // If local design: use provided image
  if (designSource.type === 'local' && designSource.imagePath) {
    const imageData = fs.readFileSync(designSource.imagePath);
    return {
      type: 'reference',
      source: designSource,
      imageData,
      timestamp: new Date().toISOString()
    };
  }
  
  // No reference available
  return { type: 'missing_reference', reason: 'No reference image available' };
}
```

**Step 2: Capture Implementation (Code)**
```javascript
export async function captureImplementation(implementationUrl, options = {}) {
  // Use browser automation if available
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(implementationUrl);
    
    const screenshot = await page.screenshot(options);
    
    await browser.close();
    
    return {
      type: 'implementation',
      source: implementationUrl,
      imageData: screenshot,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Fallback: capture placeholder
    return {
      type: 'implementation',
      source: implementationUrl,
      imageData: null,
      timestamp: new Date().toISOString(),
      error: error.message,
      fallback: true
    };
  }
}
```

**Step 3: Generate Diff**
```javascript
export function generateDiff(reference, implementation, options = {}) {
  const threshold = options.threshold || 0.05; // 5% difference threshold
  
  if (!reference.imageData || !implementation.imageData) {
    return {
      type: 'diff',
      comparison: 'skipped',
      reason: 'Missing images',
      differencePercentage: null
    };
  }
  
  // Use pixel-diff or pixelmatch for comparison
  const diffResult = pixelmatch(
    reference.imageData,
    implementation.imageData,
    null,
    reference.width,
    reference.height,
    { threshold }
  );
  
  const differencePercentage = diffResult / (reference.width * reference.height);
  
  return {
    type: 'diff',
    comparison: differencePercentage <= threshold ? 'acceptable' : 'different',
    differencePercentage,
    threshold,
    diffImage: generateDiffImage(reference, implementation) // Visual diff output
  };
}
```

**Step 4: Human Review**
```javascript
export function createReviewRequest(diffResult, reference, implementation) {
  return {
    type: 'review_request',
    reference,
    implementation,
    diffResult,
    reviewInstructions: [
      'Compare reference and implementation side-by-side',
      'Check for visual differences',
      'Verify accessibility compliance',
      'Check responsiveness',
      'Approve or request changes'
    ],
    approvalRequired: true, // Always require human approval
    approvers: ['designer', 'frontend-dev', 'accessibility-expert']
  };
}
```

**Step 5: Approval Workflow**
```javascript
export async function processReview(reviewRequest) {
  const { reference, implementation, diffResult } = reviewRequest;
  
  // Display to human reviewer (side-by-side comparison)
  const reviewOutput = {
    referenceImage: reference.imageData,
    implementationImage: implementation.imageData,
    diffImage: diffResult.diffImage,
    summary: {
      status: diffResult.comparison,
      differencePercentage: diffResult.differencePercentage,
      threshold: diffResult.threshold
    }
  };
  
  // Human review happens here (outside system)
  // Reviewer either:
  // - Approves: changes approved
  // - Rejects: changes requested
  
  // System NEVER auto-approves based on diff score
  return {
    status: 'awaiting_review', // System cannot approve
    reviewOutput,
    canAutoApprove: false, // Always requires human
    autoApprovalScore: diffResult.differencePercentage,
    autoApprovalThreshold: diffResult.threshold
  };
}
```

### Visual Parity Report

```javascript
export function generateVisualParityReport(reference, implementation, diffResult, reviewResult) {
  return {
    type: 'visual_parity_report',
    timestamp: new Date().toISOString(),
    reference: {
      type: reference?.type || 'missing',
      source: reference?.source || null,
      timestamp: reference?.timestamp || null
    },
    implementation: {
      type: implementation?.type || 'missing',
      source: implementation?.source || null,
      timestamp: implementation?.timestamp || null
    },
    diff: {
      type: diffResult?.type || 'missing',
      comparison: diffResult?.comparison || 'skipped',
      differencePercentage: diffResult?.differencePercentage || null,
      threshold: diffResult?.threshold || null
    },
    review: {
      status: reviewResult?.status || 'not_started',
      approved: reviewResult?.approved || null,
      approver: reviewResult?.approver || null,
      comments: reviewResult?.comments || null
    },
    verdict: reviewResult?.approved 
      ? 'APPROVED' 
      : reviewResult?.status === 'rejected' 
        ? 'REJECTED' 
        : 'PENDING_REVIEW',
    notes: reviewResult?.approved 
      ? 'Visual parity confirmed by human reviewer' 
      : reviewResult?.status === 'rejected'
        ? 'Visual changes requested by reviewer'
        : 'Waiting for human review'
  };
}
```

### Never Auto-Approve

**Key principle**: Visual parity can never be auto-approved based on diff score alone.

```javascript
export const VISUAL_PARITY_APPROVAL_RULES = {
  DIFF_SCORE_IS_NOT_APPROVAL: true,
  HUMAN_REVIEW_REQUIRED: true,
  AUTO_APPROVAL_DISABLED: true,
  
  getApprovalStatus(report) {
    // System can only report diff, never approve
    if (report.review.approved !== null) {
      return report.review.approved ? 'APPROVED' : 'REJECTED';
    }
    return 'AWAITING_REVIEW';
  }
};
```

### Diff Visualization

```javascript
export function generateDiffImage(reference, implementation) {
  // Create side-by-side comparison image
  // Show reference on left, implementation on right, diff in center
  
  return {
    type: 'diff_image',
    width: reference.width * 3,
    height: reference.height,
    description: 'Side-by-side comparison: Reference | Diff | Implementation',
    pixels: calculateDiffPixels(reference, implementation)
  };
}
```

### Accessibility Check

Visual parity is separate from accessibility:
```javascript
export async function checkAccessibility(implementationUrl) {
  const issues = [];
  
  // Run axe-core or similar
  const accessibilityReport = await axe.run(implementationUrl);
  
  for (const violation of accessibilityReport.violations) {
    issues.push({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.length
    });
  }
  
  return {
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    issues,
    wcag: getWCAGCompliance(issues)
  };
}
```

### Integration with Workflow

```javascript
export async function runVisualParityCheck(projectContext) {
  // Capture reference
  const reference = await captureReference(projectContext.designSource);
  
  // Capture implementation
  const implementation = await captureImplementation(projectContext.implementationUrl);
  
  // Generate diff
  const diffResult = generateDiff(reference, implementation, { threshold: 0.05 });
  
  // Create review request
  const reviewRequest = createReviewRequest(diffResult, reference, implementation);
  
  // Process review (human must approve)
  const reviewResult = await processReview(reviewRequest);
  
  // Generate report
  const report = generateVisualParityReport(reference, implementation, diffResult, reviewResult);
  
  return {
    ...report,
    reviewRequired: true, // Always required
    autoApprovalPossible: false // Never auto-approve
  };
}
```

## Alternative Approach Considered

**Score-based approval with threshold**: Rejected - may miss important visual differences.

## Consequences

**Positive**:
- Clear separation of automated and human concerns
- Never misleads about approval status
- Comprehensive diff analysis
- Accessibility checks included

**Negative**:
- Requires human involvement
- Cannot be fully automated
- May slow down iteration
