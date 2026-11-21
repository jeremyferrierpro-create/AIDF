import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = new URL('.', import.meta.url).pathname;

const requiredFiles = [
  'src/core/artefacts/validation.mjs',
  'src/core/artefacts/index.mjs',
  'src/core/requirements/registry.mjs',
  'src/core/requirements/index.mjs',
  'src/core/traceability/chain.mjs',
  'src/core/traceability/index.mjs',
  'src/core/paths.mjs',
  'assets/schemas/requirement/v1.json',
  'assets/schemas/constraints/v1.json',
  'assets/schemas/discovery/v1.json',
  'assets/schemas/architecture/v1.json',
  'assets/schemas/test-plan/v1.json',
  'assets/schemas/security/threat-model/v1.json',
  'assets/schemas/decision/v1.json',
  'tests/artefacts.validation.test.mjs',
  'tests/requirements.registry.test.mjs',
  'tests/traceability.chain.test.mjs'
];

console.log('Verifying L1-B Implementation Files...\n');

let allExist = true;
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  const exists = existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allExist = false;
}

console.log(`\nAll required files exist: ${allExist ? 'YES' : 'NO'}`);
if (!allExist) {
  process.exit(1);
}
