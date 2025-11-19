import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getProjectRoot } from '../utils/paths.js';

interface InitOptions {
  project: string;
  autoStart: boolean;
}

export async function initProject(options: InitOptions) {
  const spinner = ora('Initializing Axon in your project...').start();

  try {
    const projectRoot = getProjectRoot();
    if (!projectRoot) {
      spinner.fail('Could not find project root. Make sure you\'re in a valid project directory.');
      return;
    }

    // Create .axon-ai directory
    const agentTraceDir = join(projectRoot, '.axon-ai');
    if (!existsSync(agentTraceDir)) {
      mkdirSync(agentTraceDir, { recursive: true });
    }

    // Create config file
    const configPath = join(agentTraceDir, 'config.json');
    const config = {
      project: options.project,
      version: '1.0.0',
      initialized: new Date().toISOString(),
      backend: {
        port: 3000,
        host: 'localhost'
      },
      dashboard: {
        port: 5173,
        host: 'localhost'
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Create example integration file
    const examplePath = join(agentTraceDir, 'example-integration.js');
    const exampleCode = `// Example: How to integrate Agent Trace with your LangChain agents
import { createAutoTracer } from '@axon-ai/langchain-tracer';

// Create a tracer instance (auto-detects project configuration)
const tracer = createAutoTracer();

// Example 1: Basic LLM usage
import { ChatOpenAI } from '@langchain/openai';

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  callbacks: [tracer] // Add the tracer as a callback
});

// Example 2: Agent with tools
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { DynamicTool } from '@langchain/core/tools';

// Create some example tools
const searchTool = new DynamicTool({
  name: 'search',
  description: 'Search for information online',
  func: async (query) => {
    // Your search implementation
    return \`Search results for: \${query}\`;
  }
});

const calculatorTool = new DynamicTool({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  func: async (expression) => {
    try {
      return eval(expression).toString();
    } catch (error) {
      return 'Invalid expression';
    }
  }
});

// Create agent
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools: [searchTool, calculatorTool],
  prompt: \`You are a helpful assistant with access to search and calculator tools.
Use these tools when needed to answer questions accurately.

Available tools:
- search: Search for information online
- calculator: Perform mathematical calculations

Always explain your reasoning and show your work.\`
});

// Create agent executor
const agentExecutor = new AgentExecutor({
  agent,
  tools: [searchTool, calculatorTool],
  callbacks: [tracer], // Add tracer to executor
  verbose: true
});

// Example 3: Chain usage
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

const prompt = PromptTemplate.fromTemplate(\`
You are a helpful assistant. Answer the following question:

Question: {question}

Answer:\`);

const chain = new LLMChain({
  llm: model,
  prompt: prompt,
  callbacks: [tracer] // Add tracer to chain
});

// Example usage
async function runExample() {
  try {
    // Run the agent
    const result = await agentExecutor.invoke({
      input: "What is 15 * 23? Then search for information about the result."
    });
    
    console.log('Agent result:', result);
    
    // Run the chain
    const chainResult = await chain.invoke({
      question: "What is the capital of France?"
    });
    
    console.log('Chain result:', chainResult);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    await tracer.cleanup();
  }
}

// Uncomment to run the example
// runExample();

console.log('Axon integration example created!');
console.log('Edit this file to match your agent setup.');
console.log('Make sure to start the dashboard with: axon-ai start');
`;

    writeFileSync(examplePath, exampleCode);

    // Create package.json script
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      packageJson.scripts['axon-ai:start'] = 'axon-ai start';
      packageJson.scripts['axon-ai:status'] = 'axon-ai status';
      packageJson.scripts['axon-ai:stop'] = 'axon-ai stop';

      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    spinner.succeed('Axon initialized successfully!');

    console.log(chalk.green('\n✅ Axon has been initialized in your project!'));
    console.log(chalk.blue(`📁 Project: ${options.project}`));
    console.log(chalk.blue(`📄 Config: ${configPath}`));
    console.log(chalk.blue(`📝 Example: ${examplePath}`));

    console.log(chalk.yellow('\n📋 Next steps:'));
    console.log(chalk.gray('1. Install the LangChain tracer: npm install @axon-ai/langchain-tracer'));
    console.log(chalk.gray('2. Add the tracer to your agents (see example file)'));
    console.log(chalk.gray('3. Start the dashboard: axon-ai start'));
    console.log(chalk.gray('4. Run your agents and watch them in real-time!'));

    if (options.autoStart) {
      console.log(chalk.yellow('\n🚀 Auto-starting dashboard...'));
      const { startDashboard } = await import('./start.js');
      await startDashboard({
        port: '3000',
        dashboardPort: '5173',
        open: true,
        project: options.project
      });
    }

  } catch (error) {
    spinner.fail('Failed to initialize Axon');
    throw error;
  }
}
