import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { waitForService } from '../utils/network.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

interface StartOptions {
  port: string;
  open: boolean;
  project?: string;
}

let serverProcess: ChildProcess | null = null;

/** Return the first path in the list that exists, or null. */
function firstExisting(paths: (string | null)[]): string | null {
  return paths.find((p): p is string => !!p && existsSync(p)) ?? null;
}

/** Resolve a package file via require.resolve, swallowing failures. */
function tryResolve(specifier: string): string | null {
  try {
    return require.resolve(specifier);
  } catch {
    return null;
  }
}

/**
 * Locate the backend server entry. Preference order:
 *   1. bundled inside the CLI package (published artifact)
 *   2. installed @axon-ai/backend dependency
 *   3. monorepo sibling (dev)
 */
function resolveBackendEntry(): string | null {
  return firstExisting([
    join(__dirname, '../../bundled/backend/server.js'),
    tryResolve('@axon-ai/backend/dist/server.js'),
    join(__dirname, '../../../../backend/dist/server.js'),
  ]);
}

/**
 * Locate the built dashboard dir, same preference order as the backend.
 * Passed to the backend via AXON_DASHBOARD_DIR so it serves the right UI
 * regardless of install layout.
 */
function resolveDashboardDir(): string | null {
  const pkg = tryResolve('@axon-ai/dashboard/package.json');
  return firstExisting([
    join(__dirname, '../../bundled/dashboard'),
    pkg ? join(dirname(pkg), 'dist') : null,
    join(__dirname, '../../../../dashboard/dist'),
  ]);
}

export async function startDashboard(options: StartOptions) {
  const spinner = ora('Starting Axon...').start();
  const port = parseInt(options.port, 10) || 4000;

  try {
    const backendEntry = resolveBackendEntry();
    if (!backendEntry) {
      spinner.fail('Could not locate the Axon backend. Please reinstall @axon-ai/cli.');
      return;
    }

    const dashboardDir = resolveDashboardDir();
    if (!dashboardDir) {
      spinner.warn('Dashboard build not found — starting as a pure OTLP collector (no UI).');
    }

    spinner.text = 'Launching server...';
    await startServer(backendEntry, port, dashboardDir, options.project);

    spinner.text = 'Waiting for server to be ready...';
    await waitForService(`http://localhost:${port}/health`, 20000);

    spinner.succeed('Axon is running!');

    const url = `http://localhost:${port}`;
    console.log(chalk.green('\n🚀 Axon is now running!'));
    console.log(chalk.blue(`📊 Dashboard:   ${url}`));
    console.log(chalk.blue(`📡 OTLP ingest: ${url}/v1/traces`));
    if (options.project) console.log(chalk.yellow(`📁 Project:     ${options.project}`));
    console.log(
      chalk.gray(
        '\n💡 Point your OpenTelemetry exporter (OpenLLMetry / OpenInference) at ' +
        `${url} to see your traces.`,
      ),
    );
    console.log(chalk.gray('   Press Ctrl+C to stop.\n'));

    if (options.open) {
      open(url).catch(() => {
        console.log(chalk.yellow('⚠️  Could not open the browser automatically. Visit the URL above.'));
      });
    }

    const shutdown = () => {
      console.log(chalk.yellow('\n🛑 Stopping Axon...'));
      stopServer();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep the CLI process alive while the server runs.
    await new Promise(() => {});
  } catch (error) {
    spinner.fail('Failed to start Axon');
    stopServer();
    throw error;
  }
}

function startServer(
  entry: string,
  port: number,
  dashboardDir: string | null,
  project?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Store traces under the current project's .axon-ai/ so data is scoped to
    // the project the user runs `axon start` in (and never inside node_modules).
    const dataDir = join(process.cwd(), '.axon-ai');
    mkdirSync(dataDir, { recursive: true });

    serverProcess = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'production',
        DATABASE_PATH: join(dataDir, 'traces.db'),
        ...(dashboardDir ? { AXON_DASHBOARD_DIR: dashboardDir } : {}),
        ...(project ? { AXON_PROJECT: project } : {}),
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    serverProcess.on('error', (err) => reject(new Error(`Failed to start server: ${err.message}`)));
    serverProcess.on('exit', (code) => {
      if (code && code !== 0) reject(new Error(`Server exited with code ${code}`));
    });

    // Readiness is confirmed by the /health poll in the caller, not by stdout.
    resolve();
  });
}

function stopServer(): void {
  if (!serverProcess) return;
  serverProcess.kill('SIGTERM');
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGKILL');
  }, 5000);
  serverProcess = null;
}
