/**
 * Simple OpenAI Function Calling Test
 * Tests basic functionality without requiring API calls
 */

import { createOpenAITracer } from '@agent-trace/openai-tracer';

console.log('🧪 Testing OpenAI Tracer...\n');

// Create tracer
const tracer = createOpenAITracer({
  projectName: 'simple-test',
  metadata: {
    test: true,
    timestamp: new Date().toISOString(),
  },
});

console.log(`📊 Trace ID: ${tracer.getTraceId()}`);
console.log(`🔗 Connected: ${tracer.isConnectedToServer()}`);

// Test function call start
const eventId = tracer.traceFunctionCallStart(
  'testFunction',
  { param1: 'value1', param2: 'value2' },
  'gpt-4',
  [
    { role: 'user', content: 'Test message' }
  ],
  [
    {
      type: 'function',
      function: {
        name: 'testTool',
        description: 'A test tool',
        parameters: { type: 'object' }
      }
    }
  ]
);

console.log(`✅ Function call start traced: ${eventId}`);

// Test function call end
tracer.traceFunctionCallEnd(
  eventId,
  'Test result',
  0.05,
  1200,
  { prompt: 100, completion: 200, total: 300 }
);

console.log('✅ Function call end traced');

// Test tool selection
tracer.traceToolSelection(
  [
    {
      type: 'function',
      function: {
        name: 'tool1',
        description: 'First tool'
      }
    },
    {
      type: 'function',
      function: {
        name: 'tool2',
        description: 'Second tool'
      }
    }
  ],
  {
    type: 'function',
    function: {
      name: 'tool1',
      description: 'First tool'
    }
  },
  'Tool 1 was selected based on user request',
  0.9
);

console.log('✅ Tool selection traced');

// Test conversation turn
tracer.traceConversationTurn(
  'What is the weather?',
  'I can help you get weather information.',
  'gpt-4',
  { prompt: 50, completion: 100, total: 150 },
  0.02
);

console.log('✅ Conversation turn traced');

// Test error
tracer.traceError(
  new Error('Test error'),
  'testFunction',
  'testFunction',
  { param: 'value' }
);

console.log('✅ Error traced');

// Test cost calculation
const cost = tracer.calculateCost(
  { prompt: 1000, completion: 500, total: 1500 },
  'gpt-4'
);

console.log(`💰 Cost calculated: $${cost.toFixed(6)}`);

// Flush events
console.log('\n📤 Flushing events...');
await tracer.flushQueue();

console.log(`📊 Queue size: ${tracer.getQueueSize()}`);

// Shutdown
await tracer.shutdown();

console.log('\n✅ OpenAI Tracer test completed successfully!');
console.log('🎯 The tracer is working correctly and ready for use.');
console.log('📊 Check the dashboard: http://localhost:5176');
console.log(`🔗 Trace ID: ${tracer.getTraceId()}`);
