// Example: How to integrate Axon with your LangChain agents
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
    return `Search results for: ${query}`;
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
  prompt: `You are a helpful assistant with access to search and calculator tools.
Use these tools when needed to answer questions accurately.

Available tools:
- search: Search for information online
- calculator: Perform mathematical calculations

Always explain your reasoning and show your work.`
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

const prompt = PromptTemplate.fromTemplate(`
You are a helpful assistant. Answer the following question:

Question: {question}

Answer:`);

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

console.log('Agent Trace integration example created!');
console.log('Edit this file to match your agent setup.');
console.log('Make sure to start the dashboard with: axon-ai start');
