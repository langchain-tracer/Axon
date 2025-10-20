#!/usr/bin/env node

/**
 * Test LangChain Project with Agent Trace Integration
 * 
 * This project demonstrates how to use Agent Trace Visualizer
 * with a real LangChain agent setup.
 */

import { createAutoTracer } from '@agent-trace/langchain-tracer';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { DynamicTool } from '@langchain/core/tools';
import { PromptTemplate } from '@langchain/core/prompts';

// Create tracer (auto-detects project configuration)
let tracer;

// Create some example tools
const searchTool = new DynamicTool({
  name: 'search',
  description: 'Search for information online. Input should be a search query.',
  func: async (query) => {
    console.log(`🔍 Searching for: ${query}`);
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `Search results for "${query}": Found relevant information about ${query}. This is a simulated search result.`;
  }
});

const calculatorTool = new DynamicTool({
  name: 'calculator',
  description: 'Perform mathematical calculations. Input should be a mathematical expression.',
  func: async (expression) => {
    console.log(`🧮 Calculating: ${expression}`);
    try {
      // Simple calculation (in real app, use a proper math parser)
      const result = eval(expression);
      return `The result of ${expression} is ${result}`;
    } catch (error) {
      return `Error calculating ${expression}: ${error.message}`;
    }
  }
});

const weatherTool = new DynamicTool({
  name: 'weather',
  description: 'Get weather information for a location. Input should be a city name.',
  func: async (location) => {
    console.log(`🌤️ Getting weather for: ${location}`);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return `Weather in ${location}: 72°F, partly cloudy, light winds. This is simulated weather data.`;
  }
});

// Create agent prompt
const prompt = PromptTemplate.fromTemplate(`
You are a helpful AI assistant with access to several tools. Use these tools when needed to answer questions accurately.

Available tools:
- search: Search for information online
- calculator: Perform mathematical calculations  
- weather: Get weather information for a location

Always explain your reasoning and show your work. If you use a tool, explain what you're doing and why.

Question: {input}

{agent_scratchpad}

Answer:`);

// Create agent
async function createAgent() {
  // Create LLM with tracing
  const model = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0.7,
    callbacks: [tracer]
  });

  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools: [searchTool, calculatorTool, weatherTool],
    prompt: prompt
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools: [searchTool, calculatorTool, weatherTool],
    callbacks: [tracer], // Add tracer to executor too
    verbose: true,
    maxIterations: 5
  });

  return agentExecutor;
}

// Test scenarios
const testScenarios = [
  "What is 15 * 23? Then search for information about the result.",
  "What's the weather like in San Francisco?",
  "Calculate the area of a circle with radius 5, then search for information about circles.",
  "What is 2^8? Then get the weather for New York.",
  "Search for information about artificial intelligence, then calculate 100 / 4."
];

async function runTestScenario(agentExecutor, scenario, index) {
  console.log(`\n🧪 Test Scenario ${index + 1}:`);
  console.log(`📝 Question: ${scenario}`);
  console.log('─'.repeat(60));
  
  try {
    const result = await agentExecutor.invoke({
      input: scenario
    });
    
    console.log(`✅ Result: ${result.output}`);
    console.log(`📊 Steps taken: ${result.intermediateSteps?.length || 0}`);
    
  } catch (error) {
    console.error(`❌ Error in scenario ${index + 1}:`, error.message);
  }
  
  console.log('─'.repeat(60));
}

// Main execution
async function main() {
  try {
    // Create tracer (auto-detects project configuration)
    tracer = await createAutoTracer({
      projectName: 'test-langchain-project',
      debug: true
    });

    console.log('🚀 Starting LangChain Agent with Agent Trace...');
    console.log(`📊 Trace ID: ${tracer.getTraceId()}`);
    console.log(`🔗 Connected: ${tracer.isConnected()}`);

    console.log('\n🔧 Creating agent...');
    const agentExecutor = await createAgent();
    
    console.log('\n🎯 Running test scenarios...');
    console.log('💡 Watch the Agent Trace dashboard for real-time updates!');
    console.log('🌐 Dashboard: http://localhost:5173');
    
    // Run all test scenarios
    for (let i = 0; i < testScenarios.length; i++) {
      await runTestScenario(agentExecutor, testScenarios[i], i);
      
      // Wait between scenarios to see them separately in the dashboard
      if (i < testScenarios.length - 1) {
        console.log('\n⏳ Waiting 3 seconds before next scenario...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n🎉 All test scenarios completed!');
    console.log('📊 Check the Agent Trace dashboard to see the execution traces.');
    
  } catch (error) {
    console.error('❌ Error running test:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await tracer.cleanup();
    console.log('✅ Cleanup complete!');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await tracer.cleanup();
  process.exit(0);
});

// Run the test
main().catch(console.error);
