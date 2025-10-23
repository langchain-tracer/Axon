/**
 * Comprehensive Test for Agent Trace Visualizer
 * 
 * This test demonstrates:
 * - Chain nodes (orchestration)
 * - LLM nodes (AI decisions)
 * - Tool nodes (function calls)
 * - User prompts and responses
 */

import { ChatOpenAI } from "@langchain/openai";
import { DynamicTool } from "@langchain/core/tools";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { TracingCallbackHandler } from "@codesmith/langchain-tracer";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });

// Initialize the tracer
const tracer = new TracingCallbackHandler({
  endpoint: "http://localhost:3000",
  projectName: "comprehensive-test",
  debug: true
});

console.log("🚀 Starting Comprehensive Agent Trace Test\n");

// Create tools that the agent can use
const calculatorTool = new DynamicTool({
  name: "calculator",
  description: "Useful for performing mathematical calculations. Input should be a math expression like '25 * 4' or '100 + 50'",
  func: async (input: string) => {
    console.log(`📊 Calculator tool called with: ${input}`);
    try {
      // Simple eval for demo (don't use in production!)
      const result = eval(input);
      console.log(`✅ Calculator result: ${result}`);
      return `The result is ${result}`;
    } catch (error) {
      return `Error calculating: ${error}`;
    }
  }
});

const weatherTool = new DynamicTool({
  name: "weather_api",
  description: "Get current weather for a city. Input should be the city name like 'London' or 'New York'",
  func: async (input: string) => {
    console.log(`🌤️  Weather tool called for: ${input}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const weatherData: Record<string, string> = {
      "london": "Sunny, 72°F (22°C)",
      "new york": "Cloudy, 65°F (18°C)",
      "paris": "Rainy, 59°F (15°C)",
      "tokyo": "Clear, 77°F (25°C)"
    };
    
    const city = input.toLowerCase();
    const weather = weatherData[city] || `Weather data for ${input}: Partly cloudy, 70°F (21°C)`;
    console.log(`✅ Weather result: ${weather}`);
    return weather;
  }
});

const searchTool = new DynamicTool({
  name: "web_search",
  description: "Search the web for information. Input should be a search query",
  func: async (input: string) => {
    console.log(`🔍 Search tool called with: ${input}`);
    // Simulate search
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = `Search results for "${input}": Found 3 relevant articles about ${input}. The most recent information suggests...`;
    console.log(`✅ Search complete`);
    return result;
  }
});

async function runTest() {
  try {
    console.log("📝 Initializing LLM and Agent...\n");

    // Initialize the LLM
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Get the React agent prompt from LangChain Hub
    const prompt = await pull("hwchase17/react");

    // Create the agent
    const agent = await createReactAgent({
      llm,
      tools: [calculatorTool, weatherTool, searchTool],
      prompt
    });

    // Create the agent executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools: [calculatorTool, weatherTool, searchTool],
      verbose: true,
      maxIterations: 5
    });

    // Test cases demonstrating different scenarios
    const testCases = [
      {
        name: "Simple Math Question",
        question: "What is 125 multiplied by 8?"
      },
      {
        name: "Weather Query",
        question: "What's the weather like in London?"
      },
      {
        name: "Multi-step Agent Task",
        question: "What is 45 * 12, and what's the weather in Tokyo?"
      },
      {
        name: "Search Query",
        question: "Can you search for information about artificial intelligence?"
      }
    ];

    // Run each test case
    for (const testCase of testCases) {
      console.log("\n" + "=".repeat(80));
      console.log(`🎯 TEST: ${testCase.name}`);
      console.log("=".repeat(80));
      console.log(`❓ Question: ${testCase.question}\n`);

      try {
        const result = await agentExecutor.invoke(
          { input: testCase.question },
          { callbacks: [tracer] }
        );

        console.log(`\n✅ Answer: ${result.output}\n`);
        console.log("📊 Trace captured! Check the dashboard to see:");
        console.log("   - Chain Start: User's question");
        console.log("   - LLM Nodes: Agent's thinking process");
        console.log("   - Tool Nodes: Function calls made");
        console.log("   - Chain End: Final answer to user");
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`❌ Error in test case: ${error.message}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 All tests completed!");
    console.log("=".repeat(80));
    console.log("\n📊 View your traces at: http://localhost:5173");
    console.log("💡 Each test created a trace showing:");
    console.log("   1. Chain nodes (overall task)");
    console.log("   2. LLM nodes (AI decisions)");
    console.log("   3. Tool nodes (function executions)");
    console.log("   4. User prompts → Agent responses");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
  }
}

// Run the test
console.log("🔧 Environment check...");
console.log(`   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`   Backend URL: http://localhost:3000`);
console.log(`   Dashboard URL: http://localhost:5173\n`);

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not found in .env file!");
  console.error("   Please create a .env file with: OPENAI_API_KEY=your-key-here");
  process.exit(1);
}

runTest().then(() => {
  console.log("\n✨ Test script finished. Check the dashboard!");
  process.exit(0);
}).catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});

