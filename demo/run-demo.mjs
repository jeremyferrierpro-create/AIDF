#!/usr/bin/env node
/**
 * AIDF live demo.
 *
 * This demo performs real operations against a temporary project:
 * install -> doctor -> context -> query a gate -> inspect resources.
 * It never prints predefined success messages: every summary comes from the
 * actual command output, and the demo exits with the first failing exit code.
 *
 * Usage: node demo/run-demo.mjs [--keep]
 */
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BIN = path.resolve(import.meta.dirname, '..', 'bin', 'aidf.mjs');
const keep = process.argv.includes('--keep');

async function run(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [BIN, ...args], {
      cwd: path.dirname(BIN),
      env: { ...process.env, AIDF_LOG_LEVEL: 'error' },
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

function parse(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label}: invalid JSON output (exit ${result.code}).\n${result.stdout}\n${result.stderr}`);
  }
}

async function main() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'aidf-demo-'));
  console.log(`AIDF demo — temporary project: ${root}`);
  try {
    await fsp.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'aidf-demo-project', version: '1.0.0', scripts: { test: 'node --version' } }, null, 2),
      'utf8',
    );

    const install = await run(['install', '--target', root, '--adapter', 'qoder', '--json']);
    const installed = parse(install, 'install');
    console.log(`install: created=${installed.summary.created} updated=${installed.summary.updated} conflicts=${installed.summary.conflicts} failed=${installed.summary.failed}`);
    if (install.code !== 0) process.exitCode = install.code;

    const doctor = await run(['doctor', '--target', root, '--json']);
    const diagnosed = parse(doctor, 'doctor');
    for (const check of diagnosed.checks) {
      console.log(`doctor: ${check.id} -> ${check.status}`);
    }
    if (doctor.code !== 0) process.exitCode = doctor.code;

    const context = await run(['context', '--target', root, '--task', 'add an API endpoint with a database migration', '--json']);
    const assembled = parse(context, 'context');
    console.log(`context: status=${assembled.context.status} documents=${assembled.context.documents.length} skills=${assembled.context.skills.length}`);
    if (context.code !== 0) process.exitCode = context.code;

    const gate = await run(['validate', '--gate', 'intake-entry', '--target', root, '--json']);
    const report = parse(gate, 'validate');
    console.log(`gate intake-entry: ${report.status}`);
    if (gate.code !== 0) process.exitCode = gate.code;

    const resources = await run(['resources', 'inspect', '--target', root, '--json']);
    const listed = parse(resources, 'resources');
    const counts = listed.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`resources: ${listed.length} indexed source(s) — ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    if (resources.code !== 0) process.exitCode = resources.code;

    console.log('note: this demo exercises the CLI and filesystem contracts; it does not prove Qoder runtime (/skills, Always Apply, hooks).');
  } finally {
    if (keep) {
      console.log(`Kept for inspection: ${root}`);
    } else {
      await fsp.rm(root, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
