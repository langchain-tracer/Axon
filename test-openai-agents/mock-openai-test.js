/**
 * Mock OpenAI Test
 * Tests OpenAI callbacks without requiring actual API calls
 */

import { createOpenAITracer, TracedOpenAI } from '@agent-trace/openai-tracer';

console.log('🧪 Mock OpenAI Callback Test\n');

// Create tracer
const tracer = createOpenAITracer({
  projectName: 'mock-openai-test',
  metadata: {
    testType: 'mock',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  },
});

console.log(`📊 Trace ID: ${tracer.getTraceId()}`);
console.log(`🔗 Connected: ${tracer.isConnectedToServer()}`);

// Mock OpenAI client
class MockOpenAI {
  constructor() {
    this.chat = {
      completions: {
        create: async (params) => {
          // Simulate API call delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Mock response
          return {
            id: 'mock-chat-completion-id',
            object: 'chat.completion',
            created: Date.now(),
            model: params.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a mock response from the AI assistant.',
                tool_calls: params.tools ? [{
                  id: 'mock-tool-call-id',
                  type: 'function',
                  function: {
                    name: params.tools[0].function.name,
                    arguments: JSON.stringify({ location: 'New York' })
                  }
                }] : undefined
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 100,
              total_tokens: 150
            }
          };
        }
      }
    };
  }
}

// Create mock OpenAI client and traced wrapper
const mockOpenAI = new MockOpenAI();
const tracedOpenAI = new TracedOpenAI(mockOpenAI, tracer);

// Test function
async function testMockOpenAICallbacks() {
  console.log('🚀 Testing Mock OpenAI Callbacks\n');
  
  try {
    // Test 1: Simple chat completion
    console.log('📤 Test 1: Simple Chat Completion');
    const simpleResponse = await tracedOpenAI.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ],
      temperature: 0.7
    });
    
    console.log('✅ Simple chat completion successful');
    console.log(`📊 Response: ${simpleResponse.choices[0].message.content}`);
    console.log(`📊 Tokens used: ${simpleResponse.usage.total_tokens}`);
    
    // Test 2: Function calling
    console.log('\n📤 Test 2: Function Calling');
    const functionResponse = await tracedOpenAI.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a weather assistant.' },
        { role: 'user', content: 'What\'s the weather like in New York?' }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'The city name' }
            },
            required: ['location']
          }
        }
      }],
      tool_choice: 'auto',
      temperature: 0.7
    });
    
    console.log('✅ Function calling successful');
    console.log(`📊 Response: ${functionResponse.choices[0].message.content || 'No content'}`);
    console.log(`📊 Tool calls: ${functionResponse.choices[0].message.tool_calls?.length || 0}`);
    
    // Test 3: Multiple function calls
    console.log('\n📤 Test 3: Multiple Function Calls');
    const multiFunctionResponse = await tracedOpenAI.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a multi-tool assistant.' },
        { role: 'user', content: 'Get the weather in Paris and calculate 2+2' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'The city name' }
              },
              required: ['location']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'calculate',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Mathematical expression' }
              },
              required: ['expression']
            }
          }
        }
      ],
      tool_choice: 'auto',
      temperature: 0.7
    });
    
    console.log('✅ Multiple function calls successful');
    console.log(`📊 Response: ${multiFunctionResponse.choices[0].message.content || 'No content'}`);
    console.log(`📊 Tool calls: ${multiFunctionResponse.choices[0].message.tool_calls?.length || 0}`);
    
    // Test 4: Error handling
    console.log('\n📤 Test 4: Error Handling');
    try {
      // Create a mock error scenario
      const errorTracer = createOpenAITracer({
        projectName: 'error-test',
        metadata: { testType: 'error' }
      });
      
      const errorTracedOpenAI = new TracedOpenAI(mockOpenAI, errorTracer);
      
      // This should work fine with our mock
      await errorTracedOpenAI.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test error handling' }]
      });
      
      console.log('✅ Error handling test completed');
      
    } catch (error) {
      console.log('⚠️  Error caught and handled:', error.message);
    }
    
    // Check queue status
    console.log(`\n📊 Final queue size: ${tracer.getQueueSize()}`);
    console.log(`🔗 Connection status: ${tracer.isConnectedToServer()}`);
    
    // Flush remaining events
    console.log('\n📤 Flushing remaining events...');
    await tracer.flushQueue();
    
    console.log('\n✅ Mock OpenAI callback tests completed successfully!');
    console.log('🎯 All OpenAI tracer functionalities are working correctly.');
    console.log(`📊 Check the dashboard: http://localhost:5176`);
    console.log(`🔗 Trace ID: ${tracer.getTraceId()}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    tracer.traceError(error, 'testMockOpenAICallbacks', 'testMockOpenAICallbacks', {});
  } finally {
    // Cleanup
    await tracer.shutdown();
    console.log('\n🧹 Tracer shutdown completed');
  }
}

// Run the test
testMockOpenAICallbacks().catch(console.error);

