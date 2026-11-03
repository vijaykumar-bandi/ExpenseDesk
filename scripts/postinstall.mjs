#!/usr/bin/env node
// Runs `composer install` in backend/ after `npm install`.
// Composer is not needed for the frontend, so a machine without it still installs cleanly.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backend = join(root, 'backend');

if (!existsSync(join(backend, 'composer.json'))) {
  process.exit(0);
}

const isWindows = process.platform === 'win32';

// PHP on PATH first, then the usual Windows install folders, so a PHP installed
// outside PATH still runs Composer.
function findPhp() {
  const candidates = [];
  if (process.env.PHP_BINARY) candidates.push(process.env.PHP_BINARY);
  candidates.push(isWindows ? 'php.exe' : 'php');
  if (isWindows) {
    for (const base of ['C:\\php', 'C:\\tools\\php', 'C:\\laragon\\bin\\php', 'C:\\xampp\\php']) {
      candidates.push(join(base, 'php.exe'));
    }
    // PHP installed with `winget install PHP.PHP.8.3`.
    const winget = join(
      process.env.LOCALAPPDATA || '',
      'Microsoft',
      'WinGet',
      'Packages',
      'PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'php.exe',
    );
    if (process.env.LOCALAPPDATA) candidates.push(winget);
  }
  for (const candidate of candidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (existsSync(candidate)) return candidate;
    } else {
      const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore', shell: isWindows });
      if (!probe.error && probe.status === 0) return candidate;
    }
  }
  return null;
}

// `composer` on PATH, else `php composer.phar` from the PHP folder or backend/.
function findComposer() {
  const composer = isWindows ? 'composer.bat' : 'composer';
  const probe = spawnSync(composer, ['--version'], {
    cwd: backend,
    stdio: 'ignore',
    shell: isWindows,
  });

  if (!probe.error && probe.status === 0) {
    return { command: composer, args: [], shell: isWindows };
  }

  const php = findPhp();
  if (!php) return null;

  const pharCandidates = [join(backend, 'composer.phar')];
  if (php.includes('\\') || php.includes('/')) {
    pharCandidates.push(join(dirname(php), 'composer.phar'));
  }

  for (const phar of pharCandidates) {
    if (existsSync(phar)) return { command: php, args: [phar], shell: false };
  }

  return null;
}

const composer = findComposer();

if (!composer) {
  console.warn(
    '[postinstall] Composer was not found on PATH, so backend/vendor was not installed.\n' +
      '[postinstall] Install PHP 8.3 and Composer, then run `composer install` in backend/.',
  );
  process.exit(0);
}

const result = spawnSync(
  composer.command,
  [...composer.args, 'install', '--no-interaction', '--prefer-dist'],
  {
    cwd: backend,
    stdio: 'inherit',
    shell: composer.shell,
  },
);

process.exit(result.status ?? 1);
