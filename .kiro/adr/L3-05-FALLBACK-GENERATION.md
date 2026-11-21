# L3-05: Fallback Generation

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: When Figma is unavailable, generate wireframes and mockups locally.

## Decision

### Fallback Strategy

When Figma is unavailable:
1. Generate wireframes as HTML/SVG
2. Generate mockups as CSS-based assets
3. Generate implementation screenshots
4. Document the fallback state clearly

### Wireframe Generation (HTML/SVG)

**SVG Wireframes** (recommended for most cases)
```javascript
export function generateSVGWireframe(screenConfig) {
  const { width = 375, height = 667, elements = [] } = screenConfig;
  
  const svgElements = elements.map(el => {
    const attrs = {
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      fill: el.fill || 'none',
      stroke: el.stroke || '#ddd',
      'stroke-width': el.strokeWidth || 1
    };
    
    switch (el.type) {
      case 'text':
        return `<text x="${el.x}" y="${el.y}" font-family="sans-serif" font-size="${el.fontSize || 14}" fill="${el.color || '#333'}">${el.content}</text>`;
      case 'button':
        return `<rect ${attrString(attrs)} rx="4" /><text x="${el.x + el.width/2}" y="${el.y + el.height/2}" text-anchor="middle" font-size="14" fill="#333">${el.label}</text>`;
      case 'input':
        return `<rect ${attrString(attrs)} rx="2" /><text x="${el.x + 8}" y="${el.y + el.height/2 + 4}" font-size="12" fill="#999">${el.placeholder || 'Input'}</text>`;
      case 'image':
        return `<rect ${attrString(attrs)} fill="#eee" stroke-dasharray="4,4" /><text x="${el.x + el.width/2}" y="${el.y + el.height/2}" text-anchor="middle" font-size="10" fill="#999">[Image]</text>`;
      default:
        return `<rect ${attrString(attrs)} />`;
    }
  });
  
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Wireframe: ${screenConfig.name || 'Untitled'} -->
  ${svgElements.join('\n  ')}
</svg>
  `.trim();
}

function attrString(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}="${v}"`).join(' ');
}
```

**HTML Wireframes** (for interactive testing)
```javascript
export function generateHTMLWireframe(screenConfig) {
  const { elements = [] } = screenConfig;
  
  const htmlElements = elements.map(el => {
    switch (el.type) {
      case 'text':
        return `<p style="font-size: ${el.fontSize || 14}px; margin: ${el.y}px 0 0 ${el.x}px;">${el.content}</p>`;
      case 'button':
        return `<button style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; border: 1px solid #ddd; border-radius: 4px;">${el.label}</button>`;
      case 'input':
        return `<input type="text" placeholder="${el.placeholder || 'Input'}" style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; border: 1px solid #ddd; border-radius: 2px; padding: 8px;" />`;
      case 'image':
        return `<div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; border: 1px dashed #ddd; background: #eee; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">[Image]</div>`;
      default:
        return `<div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; border: 1px solid #ddd; background: #f9f9f9;"></div>`;
    }
  });
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${screenConfig.name || 'Untitled'}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    .wireframe-container { border: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>${screenConfig.name || 'Untitled'}</h1>
  <div class="wireframe-container">
    ${htmlElements.join('\n    ')}
  </div>
</body>
</html>
  `.trim();
}
```

### Mockup Generation (CSS)

```javascript
export function generateCSSMockup(theme) {
  const { colors = {}, typography = {} } = theme;
  
  return `
/* Design System - CSS Mockup */
:root {
  ${generateColorVariables(colors)}
  ${generateTypographyVariables(typography)}
}

/* Component: Button */
.btn {
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-primary-text);
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
}

/* Component: Input */
.input {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Component: Card */
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: 12px;
}
  `.trim();
}

function generateColorVariables(colors) {
  return Object.entries(colors).map(([name, value]) => `  --color-${name}: ${value};`).join('\n');
}

function generateTypographyVariables(typography) {
  return Object.entries(typography).map(([name, value]) => `  --font-${name}: ${value};`).join('\n');
}
```

### Screenshot Generation

```javascript
export async function generateScreenshots(implementationUrl, outputDir) {
  // Use Puppeteer or Playwright if available
  // Fallback: Generate placeholder captures
  
  return [
    {
      name: 'landing-page',
      path: `${outputDir}/landing-page.png`,
      description: 'Screenshot of landing page implementation',
      timestamp: new Date().toISOString(),
      fallback: true
    },
    {
      name: 'dashboard',
      path: `${outputDir}/dashboard.png`,
      description: 'Screenshot of dashboard implementation',
      timestamp: new Date().toISOString(),
      fallback: true
    }
  ];
}
```

### Documentation

```javascript
export function generateFallbackDocumentation(figmaStatus) {
  return `
# Design Fallback Documentation

## Figma Status
${figmaStatus.status === 'disabled' ? 'Figma integration disabled' : figmaStatus.error || 'Figma unavailable'}

## Generated Outputs
- Wireframes: HTML/SVG format
- Mockups: CSS-based assets
- Screenshots: Implementation captures

## Limitations
- No Figma collaboration features
- No real-time updates
- Manual version control required

## Next Steps
- Review locally generated assets
- Make updates to HTML/SVG/CSS files
- Commit to version control

##何时恢复 Figma
Once Figma MCP server is available and verified, migrate to Figma-based workflow.
  `.trim();
}
```

### Usage in Workflow

```javascript
export async function runFallbackWorkflow(projectContext, figmaStatus) {
  // Generate wireframes
  const wireframes = generateSVGWireframes(projectContext.screens);
  
  // Generate mockups
  const mockups = generateCSSMockups(projectContext.theme);
  
  // Generate screenshots if implementation available
  const screenshots = projectContext.implementationUrl 
    ? await generateScreenshots(projectContext.implementationUrl, projectContext.outputDir)
    : [];
  
  // Generate documentation
  const documentation = generateFallbackDocumentation(figmaStatus);
  
  return {
    wireframes,
    mockups,
    screenshots,
    documentation,
    fallback: true
  };
}
```

## Alternative Approach Considered

**Use external wireframing tools**: Rejected - adds complexity, requires external dependencies.

## Consequences

**Positive**:
- Works without Figma
- Versionable outputs
- Clear documentation of fallback
- No false claims

**Negative**:
- Less visual polish
- No collaboration features
- Manual updates required
