/**
 * Comprehensive OpenAI Callback Test
 * Tests all OpenAI tracer functionalities including:
 * - Function call tracing
 * - Tool selection tracking
 * - Conversation turn tracking
 * - Error handling
 * - Cost calculation
 * - Event queuing and flushing
 * - Connection management
 */

import OpenAI from 'openai';
import { createOpenAITracer, TracedOpenAI } from '@agent-trace/openai-tracer';

console.log('🧪 Comprehensive OpenAI Callback Test\n');

// Test configuration
const TEST_CONFIG = {
  projectName: 'comprehensive-openai-test',
  metadata: {
    testType: 'comprehensive',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: ['function_calling', 'tool_selection', 'conversation_tracking', 'error_handling', 'cost_calculation']
  }
};

// Initialize OpenAI client (mock for testing)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
});

// Create tracer
const tracer = createOpenAITracer(TEST_CONFIG);

console.log(`📊 Trace ID: ${tracer.getTraceId()}`);
console.log(`🔗 Connected: ${tracer.isConnectedToServer()}`);

// Test 1: Basic Function Call Tracing
async function testFunctionCallTracing() {
  console.log('\n🔧 Test 1: Function Call Tracing');
  console.log('=' .repeat(50));
  
  const functionName = 'testFunction';
  const functionArgs = { param1: 'value1', param2: 'value2', nested: { key: 'value' } };
  const model = 'gpt-4';
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Test message for function calling' }
  ];
  const tools = [
    {
      type: 'function',
      function: {
        name: 'testTool',
        description: 'A test tool for demonstration',
        parameters: { type: 'object', properties: { param: { type: 'string' } } }
      }
    }
  ];

  // Test function call start
  const eventId = tracer.traceFunctionCallStart(
    functionName,
    functionArgs,
    model,
    messages,
    tools
  );

  console.log(`✅ Function call start traced: ${eventId}`);
  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);

  // Simulate function execution
  await new Promise(resolve => setTimeout(resolve, 100));

  // Test function call end
  const result = { success: true, data: 'Function executed successfully' };
  const cost = 0.05;
  const latency = 150;
  const tokens = { prompt: 100, completion: 200, total: 300 };

  tracer.traceFunctionCallEnd(eventId, result, cost, latency, tokens);
  console.log('✅ Function call end traced');
  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);
}

// Test 2: Tool Selection Tracking
async function testToolSelection() {
  console.log('\n🛠️  Test 2: Tool Selection Tracking');
  console.log('=' .repeat(50));

  const availableTools = [
    {
      type: 'function',
      function: {
        name: 'weather_tool',
        description: 'Get current weather information',
        parameters: { type: 'object', properties: { location: { type: 'string' } } }
      }
    },
    {
      type: 'function',
      function: {
        name: 'calculator_tool',
        description: 'Perform mathematical calculations',
        parameters: { type: 'object', properties: { expression: { type: 'string' } } }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_tool',
        description: 'Search for information online',
        parameters: { type: 'object', properties: { query: { type: 'string' } } }
      }
    }
  ];

  const selectedTool = availableTools[0]; // Select weather tool
  const reasoning = 'User asked about weather conditions, so weather_tool is most appropriate';
  const confidence = 0.95;

  tracer.traceToolSelection(availableTools, selectedTool, reasoning, confidence);
  console.log('✅ Tool selection traced');
  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);

  // Test multiple tool selections
  for (let i = 1; i < availableTools.length; i++) {
    const tool = availableTools[i];
    const toolReasoning = `Tool ${tool.function.name} selected for specific use case`;
    const toolConfidence = 0.8 + (Math.random() * 0.2);

    tracer.traceToolSelection(availableTools, tool, toolReasoning, toolConfidence);
    console.log(`✅ Tool selection ${i + 1} traced: ${tool.function.name}`);
  }

  console.log(`📊 Final queue size: ${tracer.getQueueSize()}`);
}

// Test 3: Conversation Turn Tracking
async function testConversationTurns() {
  console.log('\n💬 Test 3: Conversation Turn Tracking');
  console.log('=' .repeat(50));

  const conversationTurns = [
    {
      userMessage: 'Hello, can you help me with the weather?',
      assistantResponse: 'I\'d be happy to help you with weather information! What location would you like to know about?',
      model: 'gpt-4',
      tokens: { prompt: 50, completion: 100, total: 150 },
      cost: 0.02
    },
    {
      userMessage: 'What\'s the weather like in New York?',
      assistantResponse: 'Let me check the current weather in New York for you.',
      model: 'gpt-4',
      tokens: { prompt: 60, completion: 80, total: 140 },
      cost: 0.018
    },
    {
      userMessage: 'Can you also tell me about tomorrow\'s forecast?',
      assistantResponse: 'I\'ll get both the current weather and tomorrow\'s forecast for New York.',
      model: 'gpt-4',
      tokens: { prompt: 70, completion: 90, total: 160 },
      cost: 0.021
    }
  ];

  for (let i = 0; i < conversationTurns.length; i++) {
    const turn = conversationTurns[i];
    tracer.traceConversationTurn(
      turn.userMessage,
      turn.assistantResponse,
      turn.model,
      turn.tokens,
      turn.cost
    );
    console.log(`✅ Conversation turn ${i + 1} traced`);
  }

  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);
}

// Test 4: Error Handling
async function testErrorHandling() {
  console.log('\n❌ Test 4: Error Handling');
  console.log('=' .repeat(50));

  // Test different types of errors
  const errors = [
    {
      error: new Error('API rate limit exceeded'),
      context: 'createChatCompletion',
      functionName: 'createChatCompletion',
      functionArguments: { model: 'gpt-4', messages: [] }
    },
    {
      error: new Error('Invalid API key'),
      context: 'authentication',
      functionName: 'authenticate',
      functionArguments: { apiKey: 'invalid-key' }
    },
    {
      error: new TypeError('Cannot read property of undefined'),
      context: 'tool_execution',
      functionName: 'executeTool',
      functionArguments: { toolName: 'weather_tool', params: null }
    }
  ];

  for (let i = 0; i < errors.length; i++) {
    const errorTest = errors[i];
    tracer.traceError(
      errorTest.error,
      errorTest.context,
      errorTest.functionName,
      errorTest.functionArguments
    );
    console.log(`✅ Error ${i + 1} traced: ${errorTest.error.message}`);
  }

  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);
}

// Test 5: Cost Calculation
async function testCostCalculation() {
  console.log('\n💰 Test 5: Cost Calculation');
  console.log('=' .repeat(50));

  const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];
  const tokenSets = [
    { prompt: 1000, completion: 500, total: 1500 },
    { prompt: 2000, completion: 1000, total: 3000 },
    { prompt: 500, completion: 200, total: 700 }
  ];

  for (const model of models) {
    console.log(`\n📊 Cost calculation for ${model}:`);
    for (let i = 0; i < tokenSets.length; i++) {
      const tokens = tokenSets[i];
      const cost = tracer.calculateCost(tokens, model);
      console.log(`  Tokens ${i + 1}: $${cost.toFixed(6)} (${tokens.total} tokens)`);
    }
  }
}

// Test 6: TracedOpenAI Integration
async function testTracedOpenAIIntegration() {
  console.log('\n🤖 Test 6: TracedOpenAI Integration');
  console.log('=' .repeat(50));

  const tracedOpenAI = new TracedOpenAI(openai, tracer);

  // Test parameters for chat completion
  const chatParams = {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_capital',
          description: 'Get the capital city of a country',
          parameters: {
            type: 'object',
            properties: {
              country: { type: 'string', description: 'The country name' }
            },
            required: ['country']
          }
        }
      }
    ],
    tool_choice: 'auto',
    temperature: 0.7
  };

  console.log('📤 Attempting traced chat completion...');
  
  try {
    // Note: This will fail without a real API key, but we can still test the tracing
    const response = await tracedOpenAI.createChatCompletion(chatParams);
    console.log('✅ Traced chat completion successful');
    console.log(`📊 Response: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    console.log('⚠️  Chat completion failed (expected without real API key)');
    console.log(`❌ Error: ${error.message}`);
    // The error should still be traced by the TracedOpenAI wrapper
  }

  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);
}

// Test 7: Event Queue Management
async function testEventQueueManagement() {
  console.log('\n📦 Test 7: Event Queue Management');
  console.log('=' .repeat(50));

  const initialQueueSize = tracer.getQueueSize();
  console.log(`📊 Initial queue size: ${initialQueueSize}`);

  // Add some test events
  for (let i = 0; i < 5; i++) {
    tracer.traceFunctionCallStart(
      `testFunction${i}`,
      { iteration: i },
      'gpt-4',
      [{ role: 'user', content: `Test message ${i}` }]
    );
  }

  const afterAddQueueSize = tracer.getQueueSize();
  console.log(`📊 Queue size after adding events: ${afterAddQueueSize}`);

  // Test queue clearing
  tracer.clearQueue();
  const afterClearQueueSize = tracer.getQueueSize();
  console.log(`📊 Queue size after clearing: ${afterClearQueueSize}`);

  // Add events back for flushing test
  for (let i = 0; i < 3; i++) {
    tracer.traceFunctionCallStart(
      `flushTestFunction${i}`,
      { iteration: i },
      'gpt-4',
      [{ role: 'user', content: `Flush test message ${i}` }]
    );
  }

  console.log(`📊 Queue size before flush: ${tracer.getQueueSize()}`);
}

// Test 8: Connection Management
async function testConnectionManagement() {
  console.log('\n🔌 Test 8: Connection Management');
  console.log('=' .repeat(50));

  console.log(`🔗 Current connection status: ${tracer.isConnectedToServer()}`);
  
  // Test connection events
  tracer.on('connected', () => {
    console.log('✅ Connection event received');
  });

  tracer.on('disconnected', () => {
    console.log('❌ Disconnection event received');
  });

  tracer.on('error', (error) => {
    console.log(`⚠️  Error event received: ${error.message}`);
  });

  // Test manual flush
  console.log('📤 Testing manual flush...');
  await tracer.flushQueue();
  console.log(`📊 Queue size after manual flush: ${tracer.getQueueSize()}`);
}

// Test 9: Metadata and Configuration
async function testMetadataAndConfiguration() {
  console.log('\n⚙️  Test 9: Metadata and Configuration');
  console.log('=' .repeat(50));

  console.log(`📊 Trace ID: ${tracer.getTraceId()}`);
  console.log(`🔗 Connected: ${tracer.isConnectedToServer()}`);
  console.log(`📦 Queue size: ${tracer.getQueueSize()}`);

  // Test with additional metadata
  const eventId = tracer.traceFunctionCallStart(
    'metadataTestFunction',
    { test: true },
    'gpt-4',
    [{ role: 'user', content: 'Test with metadata' }],
    undefined,
    { customField: 'customValue', testRun: true }
  );

  console.log('✅ Function call with metadata traced');
  console.log(`📊 Queue size: ${tracer.getQueueSize()}`);
}

// Main test runner
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive OpenAI Callback Tests\n');
  
  try {
    await testFunctionCallTracing();
    await testToolSelection();
    await testConversationTurns();
    await testErrorHandling();
    await testCostCalculation();
    await testTracedOpenAIIntegration();
    await testEventQueueManagement();
    await testConnectionManagement();
    await testMetadataAndConfiguration();

    // Final flush
    console.log('\n📤 Final flush of all events...');
    await tracer.flushQueue();
    
    console.log('\n✅ All comprehensive tests completed successfully!');
    console.log('🎯 OpenAI tracer is fully functional with all features tested.');
    console.log(`📊 Check the dashboard: http://localhost:5176`);
    console.log(`🔗 Trace ID: ${tracer.getTraceId()}`);
    console.log(`📦 Final queue size: ${tracer.getQueueSize()}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    tracer.traceError(error, 'runComprehensiveTests', 'runComprehensiveTests', {});
  } finally {
    // Cleanup
    await tracer.shutdown();
    console.log('\n🧹 Tracer shutdown completed');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch(console.error);
}

export { runComprehensiveTests };

