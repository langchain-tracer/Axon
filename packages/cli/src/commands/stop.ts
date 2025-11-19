import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function stop() {
  const spinner = ora('Stopping Agent Trace services...').start();

  try {
    // Find and kill processes running on common ports
    const ports = [3000, 5173]; // Backend and dashboard ports
    const killPromises: Promise<void>[] = [];

    for (const port of ports) {
      try {
        // Find process using the port
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        if (stdout.trim()) {
          const pids = stdout.trim().split('\n');
          for (const pid of pids) {
            if (pid) {
              killPromises.push(
                execAsync(`kill -TERM ${pid}`).then(() => {}).catch(() => {
                  // If TERM fails, try KILL
                  return execAsync(`kill -KILL ${pid}`).then(() => {});
                })
              );
            }
          }
        }
      } catch (error) {
        // Port not in use, continue
      }
    }

    // Also try to kill any axon-ai processes
    try {
      const { stdout } = await execAsync('pgrep -f "axon-ai"');
      if (stdout.trim()) {
        const pids = stdout.trim().split('\n');
        for (const pid of pids) {
          if (pid) {
            killPromises.push(
              execAsync(`kill -TERM ${pid}`).then(() => {}).catch(() => {
                return execAsync(`kill -KILL ${pid}`).then(() => {});
              })
            );
          }
        }
      }
    } catch (error) {
      // No Axon processes found
    }

    if (killPromises.length > 0) {
      await Promise.all(killPromises);
      spinner.succeed(`Stopped ${killPromises.length} Axon processes`);
    } else {
      spinner.succeed('No Axon services were running');
    }

    console.log(chalk.green('\n✅ Axon services have been stopped.'));
    console.log(chalk.gray('All tracing has been disabled.'));

  } catch (error) {
    spinner.fail('Failed to stop some services');
    console.log(chalk.yellow('Some processes may still be running.'));
    console.log(chalk.gray('You can manually kill them or restart your terminal.'));
  }
}
