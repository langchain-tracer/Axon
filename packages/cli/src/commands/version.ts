import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function version() {
  try {
    // Read version from package.json
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    console.log(chalk.blue('Agent Trace CLI'));
    console.log(chalk.gray('═'.repeat(20)));
    console.log(chalk.green(`Version: ${packageJson.version}`));
    console.log(chalk.gray(`Description: ${packageJson.description}`));
    console.log(chalk.gray(`License: ${packageJson.license}`));
    
    if (packageJson.repository?.url) {
      console.log(chalk.gray(`Repository: ${packageJson.repository.url}`));
    }

    console.log(chalk.yellow('\n💡 For more information, visit:'));
    console.log(chalk.blue('   https://github.com/yourusername/agent-trace-visualizer'));
    
  } catch (error) {
    console.log(chalk.red('❌ Could not read version information'));
    console.log(chalk.gray('Version: 1.0.0 (fallback)'));
  }
}

