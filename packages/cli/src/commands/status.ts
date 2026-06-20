import chalk from 'chalk';
import ora from 'ora';
import { checkPort } from '../utils/network.js';
import { getProjectRoot } from '../utils/paths.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export async function status() {
  const spinner = ora('Checking Axon status...').start();

  try {
    const projectRoot = getProjectRoot();
    if (!projectRoot) {
      spinner.fail('Could not find project root. Make sure you\'re in a valid project directory.');
      return;
    }

    // Check if Axonis initialized
    const configPath = join(projectRoot, '.axon-ai', 'config.json');
    if (!existsSync(configPath)) {
      spinner.fail('Axon is not initialized in this project.');
      console.log(chalk.yellow('Run "axon-ai init" to initialize Axon.'));
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    // Axon runs as a single service (backend serves the dashboard).
    const port = config.port || config.backend?.port || 4000;
    const running = await checkPort(port);

    spinner.succeed('Status check completed!');

    console.log(chalk.green('\n📊 Axon Status'));
    console.log(chalk.blue('═'.repeat(30)));

    console.log(chalk.blue(`📁 Project: ${config.project}`));
    console.log(chalk.blue(`📅 Initialized: ${new Date(config.initialized).toLocaleString()}`));

    if (running) {
      console.log(chalk.green(`✅ Axon: Running on port ${port}`));
      console.log(chalk.gray(`   Dashboard:   http://localhost:${port}`));
      console.log(chalk.gray(`   OTLP ingest: http://localhost:${port}/v1/traces`));
      console.log(chalk.gray(`   Health:      http://localhost:${port}/health`));
      console.log(chalk.green('\n🎉 Axon is operational!'));
    } else {
      console.log(chalk.red(`❌ Axon: Not running (port ${port})`));
      console.log(chalk.yellow('\nRun "axon-ai start" to start Axon.'));
    }

    console.log(chalk.blue('\n🔧 Quick Actions:'));
    console.log(chalk.gray(running ? '   axon-ai stop     - Stop Axon' : '   axon-ai start    - Start Axon'));
    console.log(chalk.gray('   axon-ai init     - Reinitialize project'));

  } catch (error) {
    spinner.fail('Failed to check status');
    throw error;
  }
}
