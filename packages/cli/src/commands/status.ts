import chalk from 'chalk';
import ora from 'ora';
import { checkPort } from '../utils/network.js';
import { getProjectRoot } from '../utils/paths.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export async function status() {
  const spinner = ora('Checking Agent Trace status...').start();

  try {
    const projectRoot = getProjectRoot();
    if (!projectRoot) {
      spinner.fail('Could not find project root. Make sure you\'re in a valid project directory.');
      return;
    }

    // Check if Agent Trace is initialized
    const configPath = join(projectRoot, '.agent-trace', 'config.json');
    if (!existsSync(configPath)) {
      spinner.fail('Agent Trace is not initialized in this project.');
      console.log(chalk.yellow('Run "agent-trace init" to initialize Agent Trace.'));
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    // Check backend status
    const backendPort = config.backend?.port || 3000;
    const dashboardPort = config.dashboard?.port || 5173;

    const backendRunning = await checkPort(backendPort);
    const dashboardRunning = await checkPort(dashboardPort);

    spinner.succeed('Status check completed!');

    console.log(chalk.green('\n📊 Agent Trace Status'));
    console.log(chalk.blue('═'.repeat(30)));

    // Project info
    console.log(chalk.blue(`📁 Project: ${config.project}`));
    console.log(chalk.blue(`📅 Initialized: ${new Date(config.initialized).toLocaleString()}`));

    // Backend status
    if (backendRunning) {
      console.log(chalk.green(`✅ Backend: Running on port ${backendPort}`));
      console.log(chalk.gray(`   API: http://localhost:${backendPort}`));
      console.log(chalk.gray(`   Health: http://localhost:${backendPort}/health`));
    } else {
      console.log(chalk.red(`❌ Backend: Not running (port ${backendPort})`));
    }

    // Dashboard status
    if (dashboardRunning) {
      console.log(chalk.green(`✅ Dashboard: Running on port ${dashboardPort}`));
      console.log(chalk.gray(`   URL: http://localhost:${dashboardPort}`));
    } else {
      console.log(chalk.red(`❌ Dashboard: Not running (port ${dashboardPort})`));
    }

    // Overall status
    if (backendRunning && dashboardRunning) {
      console.log(chalk.green('\n🎉 Agent Trace is fully operational!'));
      console.log(chalk.yellow('💡 Your agents are being traced in real-time.'));
    } else if (backendRunning || dashboardRunning) {
      console.log(chalk.yellow('\n⚠️  Agent Trace is partially running.'));
      console.log(chalk.gray('Some services may need to be restarted.'));
    } else {
      console.log(chalk.red('\n❌ Agent Trace is not running.'));
      console.log(chalk.yellow('Run "agent-trace start" to start all services.'));
    }

    // Quick actions
    console.log(chalk.blue('\n🔧 Quick Actions:'));
    if (!backendRunning || !dashboardRunning) {
      console.log(chalk.gray('   agent-trace start    - Start all services'));
    }
    if (backendRunning || dashboardRunning) {
      console.log(chalk.gray('   agent-trace stop     - Stop all services'));
    }
    console.log(chalk.gray('   agent-trace init     - Reinitialize project'));

  } catch (error) {
    spinner.fail('Failed to check status');
    throw error;
  }
}
