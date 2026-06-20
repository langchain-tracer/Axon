import net from 'net';

/**
 * Check if a port is in use (cross-platform).
 * Resolves true if something is already listening on the port.
 */
export async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
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

