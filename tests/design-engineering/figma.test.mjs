import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFigma, testConnection, verifyIdentity, checkPermissions, checkFile } from '../../src/core/design-engineering/figma/validators.mjs';

test('validateFigma returns disabled when figma disabled', async () => {
  const result = await validateFigma({ enabled: false });
  
  assert.equal(result.status, 'disabled');
});

test('validateFigma returns configuration_missing when missing config', async () => {
  const result = await validateFigma({ enabled: true });
  
  assert.equal(result.status, 'configuration_missing');
});

test('testConnection returns connected for valid config', async () => {
  const config = { apiKey: 'valid-key', fileId: 'file123' };
  const result = await testConnection(config);
  
  assert.equal(result.status, 'connected');
});

test('testConnection returns error for invalid config', async () => {
  const config = { apiKey: 'invalid', fileId: 'file123' };
  const result = await testConnection(config);
  
  assert.equal(result.status, 'error');
  assert.ok(result.error);
});

test('verifyIdentity returns verified status', async () => {
  const config = { apiKey: 'valid-key', fileId: 'file123' };
  const result = await verifyIdentity(config);
  
  assert.equal(result.status, 'verified');
  assert.ok(result.identity);
  assert.ok(result.identity.id);
  assert.ok(result.identity.handle);
});

test('checkPermissions returns authorized when read permission exists', async () => {
  const config = { apiKey: 'valid-key', fileId: 'file123' };
  const result = await checkPermissions(config, ['read']);
  
  assert.equal(result.status, 'authorized');
  assert.equal(result.missing.length, 0);
});

test('checkPermissions returns unauthorized when missing permission', async () => {
  const config = { apiKey: 'valid-key', fileId: 'file123' };
  const result = await checkPermissions(config, ['write']);
  
  assert.equal(result.status, 'unauthorized');
  assert.ok(result.missing.includes('write'));
});

test('checkFile returns accessible for valid file', async () => {
  const config = { apiKey: 'valid-key', fileId: 'file123' };
  const result = await checkFile(config, 'file123');
  
  assert.equal(result.status, 'accessible');
  assert.ok(result.fileId);
  assert.ok(result.name);
});

test('checkFile returns error for nonexistent file', async () => {
  const config = { apiKey: 'valid-key', fileId: 'file123' };
  const result = await checkFile(config, 'nonexistent');
  
  assert.equal(result.status, 'error');
  assert.ok(result.fileExists === false);
});

test('validateFigma returns fully_verified when all checks pass', async () => {
  const config = { enabled: true, apiKey: 'valid-key', fileId: 'file123' };
  const result = await validateFigma(config);
  
  assert.equal(result.status, 'fully_verified');
  assert.ok(result.identity);
});
