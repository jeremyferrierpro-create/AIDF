# L3-04: Figma Integration Protocol

**Date**: 2026-11-20  
**Status**: Approved  
**Author**: Kiro  
**Context**: Figma integration should only happen if MCP server is available and verified.

## Decision

### MCP Figma Server Detection

**Step 1: Check MCP Configuration**
```javascript
async function checkFigmaMCP() {
  const mcpConfig = await loadMCPConfig();
  return mcpConfig.servers?.figma !== undefined;
}
```

**Step 2: Connection Test**
```javascript
async function testFigmaConnection(config) {
  try {
    const client = createFigmaClient(config);
    await client.testConnection();
    return true;
  } catch (error) {
    return false;
  }
}
```

### Full Validation Sequence

Before any Figma operation, perform:

**1. Connection Test**
```javascript
export async function testConnection(figmaConfig) {
  try {
    const client = createFigmaClient(figmaConfig);
    await client.testConnection();
    return { status: 'connected', error: null };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

**2. Identity Verification**
```javascript
export async function verifyIdentity(figmaConfig) {
  try {
    const client = createFigmaClient(figmaConfig);
    const me = await client.getMe();
    return { 
      status: 'verified',
      identity: {
        id: me.id,
        handle: me.handle,
        email: me.email
      }
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

**3. Permission Check**
```javascript
export async function checkPermissions(figmaConfig, requiredPermissions) {
  const permissions = {
    read: ['files', 'components', 'styles', 'comments', 'vars'],
    write: ['comments', 'updates', 'projects']
  };
  
  try {
    const client = createFigmaClient(figmaConfig);
    const me = await client.getMe();
    
    const hasPermissions = requiredPermissions.every(p => 
      me.permissions?.[p] === true || me.role === 'admin'
    );
    
    return {
      status: hasPermissions ? 'authorized' : 'unauthorized',
      missing: requiredPermissions.filter(p => !me.permissions?.[p])
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

**4. File Accessibility**
```javascript
export async function checkFile(figmaConfig, fileId) {
  try {
    const client = createFigmaClient(figmaConfig);
    const file = await client.getFile(fileId);
    
    return {
      status: 'accessible',
      fileId,
      name: file.name,
      owner: file.owner,
      lastModified: file.modified_at
    };
  } catch (error) {
    return { 
      status: 'error', 
      error: error.message,
      fileExists: error.message.includes('not found') 
    };
  }
}
```

### Combined Validation

```javascript
export async function validateFigma(figmaConfig) {
  if (!figmaConfig?.enabled) {
    return { status: 'disabled' };
  }
  
  if (!figmaConfig.apiKey || !figmaConfig.fileId) {
    return { status: 'configuration_missing' };
  }
  
  const connection = await testConnection(figmaConfig);
  if (connection.status !== 'connected') {
    return { status: 'connection_failed', error: connection.error };
  }
  
  const identity = await verifyIdentity(figmaConfig);
  if (identity.status !== 'verified') {
    return { status: 'identity_failed', error: identity.error };
  }
  
  const permissions = await checkPermissions(figmaConfig, ['read']);
  if (permissions.status !== 'authorized') {
    return { 
      status: 'permissions_failed', 
      missing: permissions.missing 
    };
  }
  
  const file = await checkFile(figmaConfig, figmaConfig.fileId);
  if (file.status !== 'accessible') {
    return { 
      status: 'file_failed', 
      error: file.error,
      fileExists: file.fileExists 
    };
  }
  
  return { 
    status: 'fully_verified',
    identity: identity.identity
  };
}
```

### Usage in Design Workflow

```javascript
export async function runDesignWorkflow(projectContext) {
  // Check Figma availability
  const figmaStatus = await validateFigma(projectContext.figma);
  
  // Use appropriate workflow based on availability
  if (figmaStatus.status !== 'fully_verified') {
    return runFallbackWorkflow(projectContext, figmaStatus);
  }
  
  // Proceed with Figma-enabled workflow
  return runFigmaWorkflow(projectContext);
}
```

### Fallback Handling

If validation fails:
```javascript
export function handleFigmaFailure(figmaStatus) {
  const reasons = [];
  
  if (figmaStatus.status === 'disabled') {
    reasons.push('Figma integration disabled');
  }
  if (figmaStatus.status === 'configuration_missing') {
    reasons.push('Missing Figma configuration');
  }
  if (figmaStatus.status === 'connection_failed') {
    reasons.push(`Connection failed: ${figmaStatus.error}`);
  }
  if (figmaStatus.status === 'permissions_failed') {
    reasons.push(`Missing permissions: ${figmaStatus.missing.join(', ')}`);
  }
  if (figmaStatus.status === 'file_failed') {
    reasons.push(`File access failed: ${figmaStatus.error}`);
  }
  
  return {
    fallback: true,
    reasons,
    recommendedAction: 'Generate local wireframes'
  };
}
```

### Documentation Requirements

If Figma fails:
- Document all failure reasons
- Generate fallback outputs (HTML/SVG wireframes)
- Document limitations
- Record that Figma was unavailable

## Alternative Approach Considered

**Automatic Figma usage if API key present**: Rejected - doesn't verify connectivity or permissions.

## Consequences

**Positive**:
- Safe fallback when Figma unavailable
- Clear documentation of limitations
- No false claims about Figma availability
- Modular, testable validation

**Negative**:
- Additional setup for Figma
- More code to maintain
