import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSVGWireframe, generateHTMLWireframe } from '../../src/core/design-engineering/fallback/wireframes.mjs';
import { generateCSSMockup } from '../../src/core/design-engineering/fallback/mockups.mjs';

test('generateSVGWireframe creates valid SVG', async () => {
  const screen = {
    name: 'Home Page',
    width: 375,
    height: 667,
    elements: [
      { type: 'text', x: 20, y: 50, fontSize: 24, content: 'Welcome' },
      { type: 'button', x: 100, y: 100, width: 175, height: 48, label: 'Sign In' },
      { type: 'input', x: 20, y: 170, width: 335, height: 48, placeholder: 'Email' }
    ]
  };
  
  const result = generateSVGWireframe(screen);
  
  assert.equal(result.type, 'svg');
  assert.equal(result.name, 'Home Page');
  assert.ok(result.svg.includes('<svg'));
  assert.ok(result.svg.includes('Welcome'));
  assert.ok(result.svg.includes('Sign In'));
});

test('generateSVGWireframe escapes XML characters', async () => {
  const screen = {
    name: 'Test <script>',
    elements: [
      { type: 'text', x: 20, y: 50, content: 'Test & < > " ' }
    ]
  };
  
  const result = generateSVGWireframe(screen);
  
  assert.ok(result.svg.includes('&amp;'));
  assert.ok(result.svg.includes('&lt;'));
  assert.ok(result.svg.includes('&gt;'));
});

test('generateHTMLWireframe creates valid HTML', async () => {
  const screen = {
    name: 'Login Page',
    elements: [
      { type: 'text', x: 20, y: 50, fontSize: 24, content: 'Login' },
      { type: 'button', x: 100, y: 100, width: 175, height: 48, label: 'Sign In' }
    ]
  };
  
  const result = generateHTMLWireframe(screen);
  
  assert.equal(result.type, 'html');
  assert.equal(result.name, 'Login Page');
  assert.ok(result.html.includes('<!DOCTYPE html>'));
  assert.ok(result.html.includes('Login'));
  assert.ok(result.html.includes('Sign In'));
});

test('generateCSSMockup creates valid CSS', async () => {
  const theme = {
    colors: {
      primary: '#0066cc',
      secondary: '#6c757d',
      success: '#28a745'
    },
    typography: {
      body: 'Arial, sans-serif',
      heading: 'Georgia, serif'
    }
  };
  
  const result = generateCSSMockup(theme);
  
  assert.equal(result.type, 'css');
  assert.ok(result.css.includes(':root'));
  assert.ok(result.css.includes('--color-primary'));
  assert.ok(result.css.includes('--font-body'));
  assert.ok(result.css.includes('.btn'));
  assert.ok(result.css.includes('.card'));
});

test('generateCSSMockup includes responsive styles', async () => {
  const theme = {
    colors: { primary: '#0066cc' }
  };
  
  const result = generateCSSMockup(theme);
  
  assert.ok(result.css.includes('@media'));
});

test('generateCSSMockup includes utility classes', async () => {
  const theme = {
    colors: { primary: '#0066cc' }
  };
  
  const result = generateCSSMockup(theme);
  
  assert.ok(result.css.includes('.text-center'));
  assert.ok(result.css.includes('.mt-sm'));
  assert.ok(result.css.includes('.py-md'));
});

test('generateSVGWireframe handles edge cases', async () => {
  const screen = {
    elements: []
  };
  
  const result = generateSVGWireframe(screen);
  
  assert.equal(result.type, 'svg');
  assert.ok(result.svg.includes('<svg'));
});

test('generateHTMLWireframe handles empty elements', async () => {
  const screen = {
    name: 'Empty Page',
    elements: []
  };
  
  const result = generateHTMLWireframe(screen);
  
  assert.equal(result.type, 'html');
  assert.ok(result.html.includes('Empty Page'));
});
