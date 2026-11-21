import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFigma, testConnection, verifyIdentity, checkPermissions, checkFile } from '../../src/core/design-engineering/figma/validators.mjs';

const FIGMA_CONFIG = { enabled: true, apiKey: 'test-token', fileId: 'file123' };

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: async () => body,
  };
}

/** Stub globalThis.fetch for the duration of fn, then restore it. */
async function withFetch(routes, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    for (const [match, response] of routes) {
      if (u.includes(match)) {
        if (response instanceof Error) throw response;
        return typeof response === 'function' ? response(u) : response;
      }
    }
    return jsonResponse(404, {});
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const ME_OK = jsonResponse(200, { id: 'u1', handle: 'tester', email: 't@example.com', seatType: 'dev' });
const FILE_OK = jsonResponse(200, { name: 'Design File', editorType: 'figma', lastModified: '2026-11-21T00:00:00Z' });

test('validateFigma returns disabled when figma disabled', async () => {
  const result = await validateFigma({ enabled: false });
  assert.equal(result.status, 'disabled');
});

test('validateFigma returns configuration_missing when missing config', async () => {
  const result = await validateFigma({ enabled: true });
  assert.equal(result.status, 'configuration_missing');
});

test('testConnection returns connected when /me answers 200', async () => {
  const result = await withFetch([['/v1/me', ME_OK]], () => testConnection({ apiKey: 'tok' }));
  assert.equal(result.status, 'connected');
});

test('testConnection returns error on 401', async () => {
  const result = await withFetch([['/v1/me', jsonResponse(401, {})]], () => testConnection({ apiKey: 'bad' }));
  assert.equal(result.status, 'error');
  assert.ok(result.error.includes('401'));
});

test('verifyIdentity returns verified status with real fields', async () => {
  const result = await withFetch([['/v1/me', ME_OK]], () => verifyIdentity({ apiKey: 'tok' }));
  assert.equal(result.status, 'verified');
  assert.equal(result.identity.handle, 'tester');
});

test('checkPermissions authorized for read, unauthorized for write', async () => {
  const read = await withFetch([['/v1/me', ME_OK]], () => checkPermissions({ apiKey: 'tok' }, ['read']));
  assert.equal(read.status, 'authorized');
  const write = await withFetch([['/v1/me', ME_OK]], () => checkPermissions({ apiKey: 'tok' }, ['write']));
  assert.equal(write.status, 'unauthorized');
  assert.ok(write.missing.includes('write'));
});

test('checkFile returns accessible for existing file', async () => {
  const result = await withFetch([['/v1/files/', FILE_OK]], () => checkFile({ apiKey: 'tok' }, 'file123'));
  assert.equal(result.status, 'accessible');
  assert.equal(result.name, 'Design File');
});

test('checkFile returns error and fileExists=false on 404', async () => {
  const result = await withFetch([['/v1/files/', jsonResponse(404, {})]], () => checkFile({ apiKey: 'tok' }, 'nonexistent'));
  assert.equal(result.status, 'error');
  assert.equal(result.fileExists, false);
});

test('validateFigma returns fully_verified when all checks pass', async () => {
  const result = await withFetch(
    [['/v1/me', ME_OK], ['/v1/files/', FILE_OK]],
    () => validateFigma(FIGMA_CONFIG),
  );
  assert.equal(result.status, 'fully_verified');
  assert.ok(result.identity);
});

test('validateFigma reports connection_failed on bad token', async () => {
  const result = await withFetch([['/v1/me', jsonResponse(403, {})]], () => validateFigma(FIGMA_CONFIG));
  assert.equal(result.status, 'connection_failed');
});

test('validateFigma reports file_failed when file is inaccessible', async () => {
  const result = await withFetch(
    [['/v1/me', ME_OK], ['/v1/files/', jsonResponse(404, {})]],
    () => validateFigma(FIGMA_CONFIG),
  );
  assert.equal(result.status, 'file_failed');
  assert.equal(result.fileExists, false);
});
