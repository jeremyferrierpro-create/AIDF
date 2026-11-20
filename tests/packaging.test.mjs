import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const REPO = path.resolve(import.meta.dirname, '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const TAR = 'tar';

async function run(command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      env: { ...process.env, AIDF_LOG_LEVEL: 'error' },
      maxBuffer: 40 * 1024 * 1024,
      timeout: 180000,
      ...options,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

function npm(args, options) {
  // npm.cmd cannot be spawned directly on Windows. Invoke cmd.exe explicitly
  // instead of enabling the shell option, so arguments stay quoted.
  if (process.platform === 'win32') {
    const line = ['npm', ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(' ');
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', line], options);
  }
  return run(NPM, args, options);
}

test('npm pack ships every file required by bootstrap and installs a working CLI', { timeout: 240000 }, async () => {
  const packDir = await fsp.mkdtemp(path.join(REPO, '.tmp-pack-'));
  try {
    const packed = await npm(['pack', '--pack-destination', path.basename(packDir), '--json'], { cwd: REPO });
    assert.equal(packed.code, 0, packed.stderr);
    const [metadata] = JSON.parse(packed.stdout);
    assert.ok(metadata.filename.endsWith('.tgz'));
    const tarball = path.join(packDir, metadata.filename);

    const listing = await run(TAR, ['-tf', tarball]);
    assert.equal(listing.code, 0, listing.stderr);
    const files = listing.stdout.split(/\r?\n/).filter(Boolean).map((f) => f.replace(/^package\//, ''));
    for (const required of [
      'INSTALLATION.md',
      'UTILISATION.md',
      'QODER.md',
      'CHANGELOG.md',
      'README.md',
      'LICENSE',
      'bin/aidf.mjs',
      'src/cli.mjs',
      'assets/workflows/gates.yaml',
      'assets/registry/sources.yaml',
      'docs/aidf/VALIDATION.md',
      'demo/run-demo.mjs',
    ]) {
      assert.ok(files.includes(required), `tarball is missing ${required}`);
    }
    assert.equal(files.some((f) => f.startsWith('tests/')), false, 'tests must not ship');

    const unpack = path.join(packDir, 'unpacked');
    await fsp.mkdir(unpack);
    const extracted = await run(TAR, ['-xf', tarball, '-C', unpack]);
    assert.equal(extracted.code, 0, extracted.stderr);
    for (const required of ['INSTALLATION.md', 'CHANGELOG.md', 'assets/workflows/gates.yaml']) {
      await fsp.access(path.join(unpack, 'package', required));
    }

    const installed = await npm(
      ['install', metadata.filename, '--prefix', 'app', '--no-audit', '--no-fund', '--ignore-scripts'],
      { cwd: packDir },
    );
    assert.equal(installed.code, 0, installed.stderr);
    const cli = path.join(packDir, 'app', 'node_modules', 'aidf', 'bin', 'aidf.mjs');
    await fsp.access(cli);

    const version = await run(process.execPath, [cli, '--version'], { cwd: packDir });
    assert.equal(version.code, 0, version.stderr);
    assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);

    const project = path.join(packDir, 'project');
    await fsp.mkdir(project);
    await fsp.writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'packed-demo', version: '1.0.0' }), 'utf8');
    const init = await run(process.execPath, [cli, 'init', '--target', project, '--adapter', 'qoder', '--json'], { cwd: packDir });
    assert.equal(init.code, 0, init.stderr);

    for (const required of [
      '.aidf/framework/INSTALLATION.md',
      '.aidf/framework/UTILISATION.md',
      '.aidf/framework/QODER.md',
      '.aidf/framework/CHANGELOG.md',
      '.aidf/framework/assets/workflows/gates.yaml',
      '.aidf/docs/PRD.md',
      '.qoder/skills/aidf-project-context/SKILL.md',
    ]) {
      await fsp.access(path.join(project, required));
    }
    const doctor = await run(process.execPath, [cli, 'doctor', '--target', project, '--json'], { cwd: packDir });
    assert.equal(doctor.code, 0, doctor.stderr);
  } finally {
    await fsp.rm(packDir, { recursive: true, force: true });
  }
});

test('npm pack dry-run does not create a tarball in the repository root', async () => {
  const before = (await fsp.readdir(REPO)).filter((f) => f.endsWith('.tgz'));
  const result = await npm(['pack', '--dry-run', '--json'], { cwd: REPO });
  assert.equal(result.code, 0, result.stderr);
  const after = (await fsp.readdir(REPO)).filter((f) => f.endsWith('.tgz'));
  assert.deepEqual(after, before);
});
