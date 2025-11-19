#!/usr/bin/env node

/**
 * Agent Trace CLI
 * 
 * A command-line tool for monitoring LangChain agents in real-time.
 * Automatically launches the dashboard and enables tracing for your projects.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { startDashboard } from './commands/start.js';
import { initProject } from './commands/init.js';
import { status } from './commands/status.js';
import { stop } from './commands/stop.js';
import { version } from './commands/version.js';

const program = new Command();

program
  .name('axon-ai')
  .description('Monitor LangChain agents in real-time with the Axon dashboard')
  .version('1.0.0');

// Start command - launches dashboard and enables tracing
program
  .command('start')
  .description('Start the Axon dashboard and enable tracing')
  .option('-p, --port <port>', 'Port for the backend server', '3000')
  .option('-d, --dashboard-port <port>', 'Port for the dashboard', '5173')
  .option('--no-open', 'Don\'t automatically open the dashboard in browser')
  .option('--project <name>', 'Project name for organizing traces')
  .action(async (options) => {
    try {
      //await startDashboard(options);
    } catch (error) {
      console.error(chalk.red('❌ Failed to start Axon:'), (error as Error).message);
      process.exit(1);
    }
  });

// Init command - sets up tracing in a project
program
  .command('init')
  .description('Initialize Axon in your project')
  .option('--project <name>', 'Project name', 'default')
  .option('--auto-start', 'Automatically start dashboard after initialization')
  .action(async (options) => {
    try {
      await initProject(options);
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Axon:'), (error as Error).message);
      process.exit(1);
    }
  });

// Status command - check if services are running
program
  .command('status')
  .description('Check the status of Axon services')
  .action(async () => {
    try {
      await status();
    } catch (error) {
      console.error(chalk.red('❌ Failed to check status:'), (error as Error).message);
      process.exit(1);
    }
  });

// Stop command - stop all services
program
  .command('stop')
  .description('Stop all Axon services')
  .action(async () => {
    try {
      await stop();
    } catch (error) {
      console.error(chalk.red('❌ Failed to stop services:'), (error as Error).message);
      process.exit(1);
    }
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    version();
  });

// Global error handling
program.exitOverride();

try {
  program.parse();
} catch (error) {
  if ((error as any).code === 'commander.unknownCommand') {
    console.error(chalk.red(`❌ Unknown command: ${(error as Error).message}`));
    console.log(chalk.yellow('Run "axon-ai --help" to see available commands.'));
  } else if ((error as any).code === 'commander.help') {
    // Help was displayed, exit normally
    process.exit(0);
  } else {
    console.error(chalk.red('❌ An error occurred:'), (error as Error).message);
  }
  process.exit(1);
}
