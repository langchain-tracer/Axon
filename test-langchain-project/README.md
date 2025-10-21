# Test LangChain Project

Test files to demonstrate the Agent Trace Visualizer with real LangChain agents.

## 🚀 Quick Start

### 1. Prerequisites

Make sure you have:
- Node.js installed
- OpenAI API key

### 2. Setup

```bash
# Install dependencies
npm install

# Create .env file in the root directory (one level up)
cd ..
echo "OPENAI_API_KEY=your-api-key-here" > .env
cd test-langchain-project
```

### 3. Start the Backend & Dashboard

```bash
# In terminal 1 - Start backend
cd ../backend
npm run dev

# In terminal 2 - Start dashboard
cd ../dashboard
npm run dev
```

### 4. Run Tests

```bash
# Simple test (one question)
npm run test:simple

# Comprehensive test (multiple scenarios)
npm run test:comprehensive
```

## 📋 Test Files

### `simple-test.ts`

Quick test showing basic flow:
- **Question**: "What is 25 * 4?"
- **Shows**: Chain → LLM → Calculator Tool → Response
- **Runtime**: ~5 seconds

**Run:**
```bash
npm run test:simple
```

### `comprehensive-test.ts`

Multiple test cases showing different scenarios:

1. **Simple Math**: "What is 125 multiplied by 8?"
   - Tests calculator tool
   
2. **Weather Query**: "What's the weather like in London?"
   - Tests weather API tool
   
3. **Multi-step Task**: "What is 45 * 12, and what's the weather in Tokyo?"
   - Tests multiple tool calls in one query
   
4. **Search Query**: "Can you search for information about artificial intelligence?"
   - Tests web search tool

**Run:**
```bash
npm run test:comprehensive
```

## 🎯 What You'll See in the Dashboard

After running a test, open http://localhost:5173 and you'll see:

### Chain Nodes (Blue/Purple)
- **Chain Start**: Shows the user's question
- **Chain End**: Shows the final answer

### LLM Nodes (Blue)
- Shows AI's thinking process
- Displays model name, tokens, cost
- Shows prompts and responses

### Tool Nodes (Green)
- Calculator, Weather API, Search
- Shows tool inputs and outputs
- Displays execution time

## 📊 Example Trace Structure

```
Chain Start: "What is 25 * 4 and weather in London?"
    ↓
LLM Node: Agent decides to use calculator
    ↓
Tool Node: Calculator(25 * 4) → "100"
    ↓
LLM Node: Agent decides to use weather API
    ↓
Tool Node: WeatherAPI(London) → "Sunny, 72°F"
    ↓
LLM Node: Agent formats final response
    ↓
Chain End: "25*4 is 100. London is sunny at 72°F"
```

## 🐛 Troubleshooting

### "OPENAI_API_KEY not found"
- Make sure `.env` file exists in the root directory (one level up from test-langchain-project)
- Check that it contains: `OPENAI_API_KEY=sk-...`

### "Connection refused to localhost:3000"
- Make sure the backend is running: `cd ../backend && npm run dev`

### "Cannot find module @codesmith/langchain-tracer"
- Run: `npm install` in the test-langchain-project directory
- The tracer is linked from `../packages/langchain-tracer`

### No traces showing in dashboard
- Check backend console for trace events
- Verify dashboard is running at http://localhost:5173
- Make sure tracer endpoint is correct: `http://localhost:3000`

## 💡 Tips

1. **View Real-time**: Keep the dashboard open while running tests to see traces appear in real-time

2. **Debug Mode**: Both tests have `debug: true` enabled, so you'll see console logs for every event

3. **Multiple Tests**: The comprehensive test runs 4 scenarios. Each creates a separate trace you can explore

4. **Click Nodes**: In the dashboard, click any node to see detailed information:
   - User prompts
   - AI responses
   - Token usage
   - Execution time
   - Cost breakdown

## 🔧 Customization

You can modify the tests to try different scenarios:

```typescript
// Change the question
const result = await executor.invoke(
  { input: "Your custom question here?" },
  { callbacks: [tracer] }
);

// Add new tools
const myTool = new DynamicTool({
  name: "my_tool",
  description: "What it does",
  func: async (input: string) => {
    // Your logic here
    return "Result";
  }
});
```

## 📚 Learn More

- [LangChain Documentation](https://js.langchain.com/)
- [OpenAI API](https://platform.openai.com/docs)
- Agent Trace Visualizer Dashboard: http://localhost:5173

