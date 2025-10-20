/**
 * Auto-detection utilities for Agent Trace
 * Automatically detects project configuration and sets up tracing
 */

// Node.js specific imports - will be handled by bundler
import { TracingCallbackHandler } from './callback';
import { TraceConfig } from './types';

/**
 * Auto-detect project configuration from .agent-trace/config.json
 */
export async function detectProjectConfig(): Promise<Partial<TraceConfig> | null> {
  if (typeof (globalThis as any).window !== 'undefined') {
    // Browser environment - return default config
    return {
      projectName: 'browser',
      endpoint: 'http://localhost:3000',
      debug: false
    };
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    
    let currentDir = process.cwd();
    const maxDepth = 10;
    let depth = 0;

    while (depth < maxDepth) {
      const configPath = path.join(currentDir, '.agent-trace', 'config.json');
      
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          return {
            projectName: config.project,
            endpoint: `http://${config.backend.host}:${config.backend.port}`,
            debug: false
          };
        } catch (error) {
          console.warn('[AgentTrace] Failed to parse config file:', error);
          return null;
        }
      }

      const parentDir = path.resolve(currentDir, '..');
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
      depth++;
    }

    return null;
  } catch (error) {
    console.warn('[AgentTrace] Failed to load fs/path modules:', error);
    return null;
  }
}

/**
 * Auto-detect project name from package.json
 */
export async function detectProjectName(): Promise<string> {
  if (typeof (globalThis as any).window !== 'undefined') {
    return 'browser';
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    
    let currentDir = process.cwd();
    const maxDepth = 10;
    let depth = 0;

    while (depth < maxDepth) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          return packageJson.name || 'default';
        } catch (error) {
          console.warn('[AgentTrace] Failed to parse package.json:', error);
          return 'default';
        }
      }

      const parentDir = path.resolve(currentDir, '..');
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
      depth++;
    }

    return 'default';
  } catch (error) {
    console.warn('[AgentTrace] Failed to load fs/path modules:', error);
    return 'default';
  }
}

/**
 * Create a tracer with auto-detected configuration
 */
export async function createAutoTracer(overrides?: Partial<TraceConfig>): Promise<TracingCallbackHandler> {
  // First try to detect from .agent-trace/config.json
  let config = await detectProjectConfig();
  
  // If not found, use package.json name and default endpoint
  if (!config) {
    config = {
      projectName: await detectProjectName(),
      endpoint: 'http://localhost:3000',
      debug: false
    };
  }

  // Apply any overrides
  const finalConfig = {
    ...config,
    ...overrides
  };

  return new TracingCallbackHandler(finalConfig);
}

/**
 * Check if Agent Trace is properly configured in the current project
 */
export async function isAgentTraceConfigured(): Promise<boolean> {
  const config = await detectProjectConfig();
  return config !== null;
}

/**
 * Get configuration status for debugging
 */
export async function getConfigurationStatus(): Promise<{
  configured: boolean;
  projectName: string;
  endpoint: string;
  source: 'config-file' | 'package-json' | 'default';
}> {
  const config = await detectProjectConfig();
  
  if (config) {
    return {
      configured: true,
      projectName: config.projectName || 'default',
      endpoint: config.endpoint || 'http://localhost:3000',
      source: 'config-file'
    };
  }

  const projectName = await detectProjectName();
  return {
    configured: false,
    projectName,
    endpoint: 'http://localhost:3000',
    source: projectName === 'default' ? 'default' : 'package-json'
  };
}
