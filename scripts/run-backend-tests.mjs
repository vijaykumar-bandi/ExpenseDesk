#!/usr/bin/env node
// Runs the backend PHPUnit suite (`php artisan test`) from backend/.
// PHP is looked up on PATH first, then in the usual Windows install folders, so
// the command works from cmd.exe without a shell-specific variable syntax.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backend = join(root, 'backend');
const isWindows = process.platform === 'win32';

function findPhp() {
  const candidates = [];
  if (process.env.PHP_BINARY) candidates.push(process.env.PHP_BINARY);
  candidates.push(isWindows ? 'php.exe' : 'php');
  if (isWindows) {
    for (const base of ['C:\\php', 'C:\\tools\\php', 'C:\\laragon\\bin\\php', 'C:\\xampp\\php']) {
      candidates.push(join(base, 'php.exe'));
    }
    // PHP installed with `winget install PHP.PHP.8.3`.
    if (process.env.LOCALAPPDATA) {
      candidates.push(
        join(
          process.env.LOCALAPPDATA,
          'Microsoft',
          'WinGet',
          'Packages',
          'PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe',
          'php.exe',
        ),
      );
    }
  }
  for (const candidate of candidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore', shell: isWindows });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

const php = findPhp();
if (!php) {
  console.error('[test:backend] PHP 8.3 was not found on PATH.');
  console.error(
    '[test:backend] Install PHP 8.3 with pdo_sqlite, mbstring, openssl and fileinfo, then retry.',
  );
  process.exit(1);
}

if (!existsSync(join(backend, 'vendor', 'autoload.php'))) {
  console.error('[test:backend] backend/vendor is missing. Run `composer install` in backend/ first.');
  process.exit(1);
}

const phpunit = join(backend, 'vendor', 'phpunit', 'phpunit', 'phpunit');
const result = spawnSync(php, [phpunit], {
  cwd: backend,
  stdio: 'inherit',
  env: { ...process.env, APP_ENV: 'testing' },
});

if (result.error) {
  console.error(`[test:backend] Could not run php: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
