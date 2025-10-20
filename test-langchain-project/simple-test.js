#!/usr/bin/env node

/**
 * Simple Test Agent for Agent Trace Visualizer
 * 
 * This is a simplified version that tests the basic functionality
 * without complex dependencies.
 */

import { createAutoTracer } from '@agent-trace/langchain-tracer';
import { ChatOpenAI } from '@langchain/openai';

async function main() {
  try {
    console.log('🚀 Starting Simple LangChain Agent with Agent Trace...');
    
    // Create tracer (auto-detects project configuration)
    const tracer = await createAutoTracer({
      projectName: 'test-langchain-project',
      debug: true
    });

    console.log(`📊 Trace ID: ${tracer.getTraceId()}`);
    console.log(`🔗 Connected: ${tracer.isConnected()}`);

    // Create LLM with tracing
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
      callbacks: [tracer]
    });

    console.log('\n🎯 Testing simple LLM call...');
    console.log('💡 Watch the Agent Trace dashboard for real-time updates!');
    console.log('🌐 Dashboard: http://localhost:5173');

    // Simple test scenarios
    const testPrompts = [
      "What is 2 + 2?",
      "Explain what artificial intelligence is in one sentence.",
      "What is the capital of France?"
    ];

    for (let i = 0; i < testPrompts.length; i++) {
      console.log(`\n🧪 Test ${i + 1}: ${testPrompts[i]}`);
      console.log('─'.repeat(50));
      
      try {
        const response = await model.invoke(testPrompts[i]);
        console.log(`✅ Response: ${response.content}`);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
      
      console.log('─'.repeat(50));
      
      // Wait between tests to see them separately in the dashboard
      if (i < testPrompts.length - 1) {
        console.log('⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n🎉 All tests completed!');
    console.log('📊 Check the Agent Trace dashboard to see the execution traces.');
    
  } catch (error) {
    console.error('❌ Error running test:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    if (typeof tracer !== 'undefined') {
      await tracer.cleanup();
    }
    console.log('✅ Cleanup complete!');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

// Run the test
main().catch(console.error);
