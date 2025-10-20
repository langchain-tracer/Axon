import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

/**
 * Find the project root by looking for package.json
 */
export function getProjectRoot(): string | null {
  let currentDir = process.cwd();
  const maxDepth = 10; // Prevent infinite loops
  let depth = 0;

  while (depth < maxDepth) {
    const packageJsonPath = join(currentDir, 'package.json');
    
    if (existsSync(packageJsonPath)) {
      return currentDir;
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  return null;
}

/**
 * Get the Agent Trace config directory for the current project
 */
export function getAgentTraceConfigDir(): string | null {
  const projectRoot = getProjectRoot();
  if (!projectRoot) {
    return null;
  }

  return join(projectRoot, '.agent-trace');
}

/**
 * Check if Agent Trace is initialized in the current project
 */
export function isAgentTraceInitialized(): boolean {
  const configDir = getAgentTraceConfigDir();
  if (!configDir) {
    return false;
  }

  const configPath = join(configDir, 'config.json');
  return existsSync(configPath);
}

/**
 * Get the global Agent Trace installation directory
 */
export function getGlobalAgentTraceDir(): string {
  try {
    // Try to get npm global prefix
    const globalPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    return join(globalPrefix, 'lib', 'node_modules', '@agent-trace');
  } catch (error) {
    // Fallback to common locations
    const homeDir = require('os').homedir();
    return join(homeDir, '.agent-trace');
  }
}

/**
 * Check if Agent Trace is installed globally
 */
export function isAgentTraceInstalledGlobally(): boolean {
  try {
    execSync('which agent-trace', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

