import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if a port is in use
 */
export async function checkPort(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for a service to be available
 */
export async function waitForService(url: string, timeout: number = 10000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Service not ready yet, continue waiting
    }
    
    // Wait 500ms before trying again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error(`Service at ${url} did not become available within ${timeout}ms`);
}

/**
 * Get available port starting from a base port
 */
export async function getAvailablePort(basePort: number): Promise<number> {
  let port = basePort;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    if (!(await checkPort(port))) {
      return port;
    }
    port++;
    attempts++;
  }

  throw new Error(`Could not find an available port starting from ${basePort}`);
}

