import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkPort, waitForService } from '../utils/network.js';
import { getProjectRoot } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StartOptions {
  port: string;
  dashboardPort: string;
  open: boolean;
  project?: string;
}

let backendProcess: ChildProcess | null = null;
let dashboardProcess: ChildProcess | null = null;

export async function startDashboard(options: StartOptions) {
  const spinner = ora('Starting Axon services...').start();

  try {
    // Check if ports are available
    spinner.text = 'Checking port availability...';
    const backendPort = parseInt(options.port);
    const dashboardPort = parseInt(options.dashboardPort);

    if (await checkPort(backendPort)) {
      spinner.fail(`Backend port ${backendPort} is already in use`);
      return;
    }

    if (await checkPort(dashboardPort)) {
      spinner.fail(`Dashboard port ${dashboardPort} is already in use`);
      return;
    }

    // Get project root
    const projectRoot = getProjectRoot();
    if (!projectRoot) {
      spinner.fail('Could not find project root. Make sure you\'re in a valid project directory.');
      return;
    }

    // Check if Axon is initialized
    const agentTraceConfig = join(projectRoot, '.axon-ai', 'config.json');
    if (!existsSync(agentTraceConfig)) {
      spinner.warn('Axon not initialized in this project. Run "axon-ai init" first.');
      return;
    }

    // Start backend server
    spinner.text = 'Starting backend server...';
    await startBackend(projectRoot, backendPort);

    // Wait for backend to be ready
    spinner.text = 'Waiting for backend to be ready...';
    await waitForService(`http://localhost:${backendPort}/health`, 10000);

    // Start dashboard
    spinner.text = 'Starting dashboard...';
    await startDashboardServer(projectRoot, dashboardPort);

    // Wait for dashboard to be ready
    spinner.text = 'Waiting for dashboard to be ready...';
    await waitForService(`http://localhost:${dashboardPort}`, 15000);

    spinner.succeed('Axon services started successfully!');

    // Display status
    console.log(chalk.green('\n🚀 Axon is now running!'));
    console.log(chalk.blue(`📊 Dashboard: http://localhost:${dashboardPort}`));
    console.log(chalk.blue(`🔧 Backend API: http://localhost:${backendPort}`));
    console.log(chalk.blue(`📈 Health Check: http://localhost:${backendPort}/health`));
    
    if (options.project) {
      console.log(chalk.yellow(`📁 Project: ${options.project}`));
    }

    console.log(chalk.gray('\n💡 Your LangChain agents will now be automatically traced.'));
    console.log(chalk.gray('   Press Ctrl+C to stop all services.'));

    // Open dashboard in browser
    if (options.open) {
      setTimeout(async () => {
        try {
          await open(`http://localhost:${dashboardPort}`);
          console.log(chalk.green('🌐 Dashboard opened in your browser!'));
        } catch (error) {
          console.log(chalk.yellow('⚠️  Could not open browser automatically. Please visit the dashboard URL above.'));
        }
      }, 2000);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down Axon services...'));
      await stopServices();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await stopServices();
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    spinner.fail('Failed to start Axon services');
    await stopServices();
    throw error;
  }
}

async function startBackend(projectRoot: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendPath = join(projectRoot, 'node_modules', '@axon-ai', 'backend', 'dist', 'server.js');
    
    // If not found in node_modules, try relative path from CLI package
    const cliBackendPath = join(__dirname, '..', '..', '..', '..', 'backend', 'dist', 'server.js');
    const backendScript = existsSync(backendPath) ? backendPath : cliBackendPath;

    if (!existsSync(backendScript)) {
      reject(new Error('Backend server not found. Please ensure Axon is properly installed.'));
      return;
    }

    backendProcess = spawn('node', [backendScript], {
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    backendProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server ready')) {
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(chalk.red('Backend error:'), data.toString());
    });

    backendProcess.on('error', (error) => {
      reject(new Error(`Failed to start backend: ${error.message}`));
    });

    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Backend process exited with code ${code}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        resolve(); // Assume it started successfully
      }
    }, 30000);
  });
}

async function startDashboardServer(projectRoot: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const dashboardPath = join(projectRoot, 'node_modules', '@axon-ai', 'dashboard', 'dist');
    
    // If not found in node_modules, try relative path from CLI package
    const cliDashboardPath = join(__dirname, '..', '..', '..', '..', 'dashboard', 'dist');
    const dashboardDist = existsSync(dashboardPath) ? dashboardPath : cliDashboardPath;

    if (!existsSync(dashboardDist)) {
      reject(new Error('Dashboard not found. Please ensure Axon is properly installed.'));
      return;
    }

    // Use a simple HTTP server for the dashboard with proper proxy configuration
    const serveArgs = [
      'serve', 
      '-s', 
      dashboardDist, 
      '-l', 
      port.toString(),
      '--cors',
      '--single'
    ];

    dashboardProcess = spawn('npx', serveArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    dashboardProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('Ready!')) {
        resolve();
      }
    });

    dashboardProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString();
      // Ignore common serve warnings
      if (!errorOutput.includes('WARN') && !errorOutput.includes('warn')) {
        console.error(chalk.red('Dashboard error:'), errorOutput);
      }
    });

    dashboardProcess.on('error', (error) => {
      reject(new Error(`Failed to start dashboard: ${error.message}`));
    });

    dashboardProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Dashboard process exited with code ${code}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (dashboardProcess && !dashboardProcess.killed) {
        resolve(); // Assume it started successfully
      }
    }, 30000);
  });
}

async function stopServices(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (backendProcess) {
    promises.push(new Promise((resolve) => {
      backendProcess!.kill('SIGTERM');
      backendProcess!.on('exit', () => resolve());
      setTimeout(() => {
        if (!backendProcess!.killed) {
          backendProcess!.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    }));
  }

  if (dashboardProcess) {
    promises.push(new Promise((resolve) => {
      dashboardProcess!.kill('SIGTERM');
      dashboardProcess!.on('exit', () => resolve());
      setTimeout(() => {
        if (!dashboardProcess!.killed) {
          dashboardProcess!.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    }));
  }

  await Promise.all(promises);
  backendProcess = null;
  dashboardProcess = null;
}
