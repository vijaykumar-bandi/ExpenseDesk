#!/usr/bin/env node
// Starts the Laravel API and the Vite dev server together.
// Ports come from the environment (PORT for Vite, API_PORT for Laravel) and are
// passed to the child processes through their env, so this works under cmd.exe.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');

const isWindows = process.platform === 'win32';
const port = process.env.PORT || '5173';

function fail(message) {
  console.error(`[dev] ${message}`);
  process.exit(1);
}

if (!existsSync(join(backend, 'vendor', 'autoload.php'))) {
  fail('backend/vendor is missing. Run `npm install` (it runs composer install) first.');
}

// 1. backend/.env from .env.example when it does not exist yet.
const envPath = join(backend, '.env');
if (!existsSync(envPath)) {
  const example = join(backend, '.env.example');
  if (existsSync(example)) {
    copyFileSync(example, envPath);
  } else {
    writeFileSync(envPath, 'APP_ENV=local\nAPP_DEBUG=true\nAPP_KEY=\nDB_CONNECTION=sqlite\n');
  }
}

// 2. An application key, so the session cookie and CSRF token work.
let envText = readFileSync(envPath, 'utf8');
if (!/^APP_KEY=.+$/m.test(envText)) {
  const key = 'base64:' + randomBytes(32).toString('base64');
  envText = /^APP_KEY=.*$/m.test(envText)
    ? envText.replace(/^APP_KEY=.*$/m, `APP_KEY=${key}`)
    : `${envText.trimEnd()}\nAPP_KEY=${key}\n`;
  writeFileSync(envPath, envText);
}

// 3. The SQLite database file.
const dbDir = join(backend, 'database');
mkdirSync(dbDir, { recursive: true });
const dbFile = join(dbDir, 'database.sqlite');
if (!existsSync(dbFile)) {
  writeFileSync(dbFile, '');
}

// PHP on PATH first, then the usual Windows install folders, so a PHP installed
// outside PATH still starts the API.
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
  fail('PHP 8.3 was not found on PATH. Install PHP 8.3 and Composer, then run `npm install` again.');
}

function reserveAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(Number(preferredPort), '127.0.0.1', () => {
      const address = server.address();
      const selectedPort = typeof address === 'object' && address ? String(address.port) : preferredPort;
      server.close((error) => (error ? reject(error) : resolve(selectedPort)));
    });
  });
}

function phpCanBind(portToCheck) {
  const probe = spawnSync(
    php,
    ['-r', `$s=@stream_socket_server('tcp://127.0.0.1:${portToCheck}', $e, $m); if (!$s) { fwrite(STDERR, $m); exit(1); } fclose($s);`],
    { cwd: backend, stdio: 'pipe', env: process.env },
  );
  return !probe.error && probe.status === 0;
}

async function selectApiPort() {
  const configured = process.env.API_PORT;
  const preferred = configured || '8000';

  try {
    const candidate = await reserveAvailablePort(preferred);
    if (phpCanBind(candidate)) return candidate;
    throw new Error('PHP cannot bind this port');
  } catch (error) {
    if (configured) {
      fail(`API_PORT ${configured} is unavailable: ${error.message}`);
    }
  }

  // Windows can reserve a port for one runtime while refusing it to another.
  // Ask the OS for candidates until both Node and PHP can bind one, then give
  // that same port to Laravel and Vite's proxy.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await reserveAvailablePort('0');
    if (phpCanBind(candidate)) {
      console.log(`[dev] Port 8000 is unavailable; using API port ${candidate}.`);
      return candidate;
    }
  }

  fail('Could not find an available loopback port for the Laravel API.');
}

const apiPort = await selectApiPort();
const childEnv = { ...process.env, API_PORT: apiPort, PORT: port };

function runPhp(args) {
  const result = spawnSync(php, args, { cwd: backend, stdio: 'inherit', env: childEnv });
  if (result.error) {
    fail(`Could not run php: ${result.error.message}. Install PHP 8.3 and Composer first.`);
  }
  if (result.status !== 0) {
    fail(`php ${args.join(' ')} failed with exit code ${result.status}.`);
  }
}

// 4. Migrations, then the idempotent development seeder (the test logins).
runPhp(['artisan', 'migrate', '--force']);
runPhp(['artisan', 'db:seed', '--class=DevelopmentSeeder', '--force']);

// 5. Both servers.
const children = [];

function start(name, command, args, cwd, shell = false) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: childEnv, shell });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited with code ${code}`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('api', php, ['artisan', 'serve', '--host=127.0.0.1', `--port=${apiPort}`], backend);
start('web', isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], frontend, isWindows);

console.log(`[dev] API on http://127.0.0.1:${apiPort}  Web on http://127.0.0.1:${port}`);
