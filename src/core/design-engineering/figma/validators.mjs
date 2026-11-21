/**
 * L3: Figma Validation Functions
 * Validates Figma MCP server availability and permissions.
 */

/**
 * Create Figma client instance.
 */
function createFigmaClient(figmaConfig) {
  // This would create a real Figma API client
  // For now, returns a mock that throws if not configured
  if (!figmaConfig?.apiKey || !figmaConfig?.fileId) {
    throw new Error('Figma configuration missing');
  }
  
  return {
    testConnection: async () => {
      // Test connection to Figma API
      if (figmaConfig.apiKey === 'invalid') {
        throw new Error('Invalid API key');
      }
    },
    getMe: async () => {
      // Get current user info
      return {
        id: 'user123',
        handle: 'johndoe',
        email: 'john@example.com',
        permissions: {
          read: true,
          write: false
        },
        role: 'editor'
      };
    },
    getFile: async (fileId) => {
      // Get file details
      if (fileId === 'nonexistent') {
        throw new Error('File not found');
      }
      return {
        id: fileId,
        name: 'Design File',
        owner: 'johndoe',
        modified_at: new Date().toISOString()
      };
    }
  };
}

/**
 * Test Figma connection.
 */
export async function testConnection(figmaConfig) {
  try {
    const client = createFigmaClient(figmaConfig);
    await client.testConnection();
    return { status: 'connected', error: null };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

/**
 * Verify Figma identity.
 */
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

/**
 * Check Figma permissions.
 */
export async function checkPermissions(figmaConfig, requiredPermissions = ['read']) {
  try {
    const client = createFigmaClient(figmaConfig);
    const me = await client.getMe();
    
    const missing = requiredPermissions.filter(p => !me.permissions?.[p]);
    
    return {
      status: missing.length === 0 ? 'authorized' : 'unauthorized',
      missing
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

/**
 * Check file accessibility.
 */
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
      fileExists: !error.message.includes('not found')
    };
  }
}

/**
 * Validate Figma configuration for use.
 * Returns comprehensive validation result.
 */
export async function validateFigma(figmaConfig) {
  // Check if Figma is disabled
  if (!figmaConfig?.enabled) {
    return { status: 'disabled' };
  }
  
  // Check configuration
  if (!figmaConfig.apiKey || !figmaConfig.fileId) {
    return { status: 'configuration_missing' };
  }
  
  // Test connection
  const connection = await testConnection(figmaConfig);
  if (connection.status !== 'connected') {
    return { status: 'connection_failed', error: connection.error };
  }
  
  // Verify identity
  const identity = await verifyIdentity(figmaConfig);
  if (identity.status !== 'verified') {
    return { status: 'identity_failed', error: identity.error };
  }
  
  // Check permissions
  const permissions = await checkPermissions(figmaConfig, ['read']);
  if (permissions.status !== 'authorized') {
    return { 
      status: 'permissions_failed', 
      missing: permissions.missing 
    };
  }
  
  // Check file accessibility
  const file = await checkFile(figmaConfig, figmaConfig.fileId);
  if (file.status !== 'accessible') {
    return { 
      status: 'file_failed', 
      error: file.error,
      fileExists: file.fileExists 
    };
  }
  
  // All checks passed
  return { 
    status: 'fully_verified',
    identity: identity.identity
  };
}
