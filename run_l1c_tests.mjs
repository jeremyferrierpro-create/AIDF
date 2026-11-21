// Simple test runner for L1-C
import { execSync } from 'node:child_process';

const tests = [
  'tests/artefacts.validation.test.mjs',
  'tests/requirements.registry.test.mjs',
  'tests/traceability.chain.test.mjs',
  'tests/traceability.link.test.mjs'
];

console.log('Running L1-C Traceability Tests...\n');

try {
  const output = execSync(`node --test ${tests.join(' ')}`, {
    encoding: 'utf8',
    stdio: 'inherit'
  });
  console.log(output);
} catch (error) {
  console.error(`Tests failed: ${error.message}`);
  process.exit(1);
}
