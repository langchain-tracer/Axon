// Build the backend + dashboard and copy their dist output into the CLI's
// bundled/ folder, so `@axon-ai/cli` ships everything and `axon start` can run
// from node_modules with no extra installs.

import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(cliRoot, '..', '..');
const bundled = join(cliRoot, 'bundled');

const run = (cmd) => execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });

console.log('› building backend + dashboard…');
run('npm run build --workspace=backend');
run('npm run build --workspace=dashboard');

const backendDist = join(repoRoot, 'backend', 'dist');
const dashboardDist = join(repoRoot, 'dashboard', 'dist');
for (const [name, dir] of [['backend', backendDist], ['dashboard', dashboardDist]]) {
  if (!existsSync(dir)) {
    console.error(`✗ expected build output missing: ${dir}`);
    process.exit(1);
  }
}

console.log('› copying into bundled/…');
rmSync(bundled, { recursive: true, force: true });
mkdirSync(bundled, { recursive: true });
cpSync(backendDist, join(bundled, 'backend'), { recursive: true });
cpSync(dashboardDist, join(bundled, 'dashboard'), { recursive: true });

console.log('✓ bundled backend -> bundled/backend, dashboard -> bundled/dashboard');
