#!/usr/bin/env node
import { main } from '../src/cli.mjs';

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write(`aidf: fatal: ${error && error.message ? error.message : String(error)}\n`);
  if (process.env.AIDF_DEBUG === '1' && error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exitCode = 70;
});
