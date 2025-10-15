"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const uuid = require("uuid");
const socket_ioClient = require("socket.io-client");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const uuid__namespace = /* @__PURE__ */ _interopNamespaceDefault(uuid);
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var decamelize = function(str, sep) {
  if (typeof str !== "string") {
    throw new TypeError("Expected a string");
  }
  sep = typeof sep === "undefined" ? "_" : sep;
  return str.replace(/([a-z\d])([A-Z])/g, "$1" + sep + "$2").replace(/([A-Z]+)([A-Z][a-z\d]+)/g, "$1" + sep + "$2").toLowerCase();
};
const snakeCase = /* @__PURE__ */ getDefaultExportFromCjs(decamelize);
var camelcase = { exports: {} };
const UPPERCASE = /[\p{Lu}]/u;
const LOWERCASE = /[\p{Ll}]/u;
const LEADING_CAPITAL = /^[\p{Lu}](?![\p{Lu}])/gu;
const IDENTIFIER = /([\p{Alpha}\p{N}_]|$)/u;
const SEPARATORS = /[_.\- ]+/;
const LEADING_SEPARATORS = new RegExp("^" + SEPARATORS.source);
const SEPARATORS_AND_IDENTIFIER = new RegExp(SEPARATORS.source + IDENTIFIER.source, "gu");
const NUMBERS_AND_IDENTIFIER = new RegExp("\\d+" + IDENTIFIER.source, "gu");
const preserveCamelCase = (string, toLowerCase, toUpperCase) => {
  let isLastCharLower = false;
  let isLastCharUpper = false;
  let isLastLastCharUpper = false;
  for (let i = 0; i < string.length; i++) {
    const character = string[i];
    if (isLastCharLower && UPPERCASE.test(character)) {
      string = string.slice(0, i) + "-" + string.slice(i);
      isLastCharLower = false;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = true;
      i++;
    } else if (isLastCharUpper && isLastLastCharUpper && LOWERCASE.test(character)) {
      string = string.slice(0, i - 1) + "-" + string.slice(i - 1);
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = false;
      isLastCharLower = true;
    } else {
      isLastCharLower = toLowerCase(character) === character && toUpperCase(character) !== character;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = toUpperCase(character) === character && toLowerCase(character) !== character;
    }
  }
  return string;
};
const preserveConsecutiveUppercase = (input, toLowerCase) => {
  LEADING_CAPITAL.lastIndex = 0;
  return input.replace(LEADING_CAPITAL, (m1) => toLowerCase(m1));
};
const postProcess = (input, toUpperCase) => {
  SEPARATORS_AND_IDENTIFIER.lastIndex = 0;
  NUMBERS_AND_IDENTIFIER.lastIndex = 0;
  return input.replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) => toUpperCase(identifier)).replace(NUMBERS_AND_IDENTIFIER, (m) => toUpperCase(m));
};
const camelCase = (input, options) => {
  if (!(typeof input === "string" || Array.isArray(input))) {
    throw new TypeError("Expected the input to be `string | string[]`");
  }
  options = {
    pascalCase: false,
    preserveConsecutiveUppercase: false,
    ...options
  };
  if (Array.isArray(input)) {
    input = input.map((x) => x.trim()).filter((x) => x.length).join("-");
  } else {
    input = input.trim();
  }
  if (input.length === 0) {
    return "";
  }
  const toLowerCase = options.locale === false ? (string) => string.toLowerCase() : (string) => string.toLocaleLowerCase(options.locale);
  const toUpperCase = options.locale === false ? (string) => string.toUpperCase() : (string) => string.toLocaleUpperCase(options.locale);
  if (input.length === 1) {
    return options.pascalCase ? toUpperCase(input) : toLowerCase(input);
  }
  const hasUpperCase = input !== toLowerCase(input);
  if (hasUpperCase) {
    input = preserveCamelCase(input, toLowerCase, toUpperCase);
  }
  input = input.replace(LEADING_SEPARATORS, "");
  if (options.preserveConsecutiveUppercase) {
    input = preserveConsecutiveUppercase(input, toLowerCase);
  } else {
    input = toLowerCase(input);
  }
  if (options.pascalCase) {
    input = toUpperCase(input.charAt(0)) + input.slice(1);
  }
  return postProcess(input, toUpperCase);
};
camelcase.exports = camelCase;
camelcase.exports.default = camelCase;
function keyToJson(key, map) {
  return (map == null ? void 0 : map[key]) || snakeCase(key);
}
function mapKeys(fields, mapper, map) {
  const mapped = {};
  for (const key in fields) {
    if (Object.hasOwn(fields, key)) {
      mapped[mapper(key, map)] = fields[key];
    }
  }
  return mapped;
}
function shallowCopy(obj) {
  return Array.isArray(obj) ? [...obj] : { ...obj };
}
function replaceSecrets(root, secretsMap) {
  const result = shallowCopy(root);
  for (const [path, secretId] of Object.entries(secretsMap)) {
    const [last, ...partsReverse] = path.split(".").reverse();
    let current = result;
    for (const part of partsReverse.reverse()) {
      if (current[part] === void 0) {
        break;
      }
      current[part] = shallowCopy(current[part]);
      current = current[part];
    }
    if (current[last] !== void 0) {
      current[last] = {
        lc: 1,
        type: "secret",
        id: [secretId]
      };
    }
  }
  return result;
}
function get_lc_unique_name(serializableClass) {
  const parentClass = Object.getPrototypeOf(serializableClass);
  const lcNameIsSubclassed = typeof serializableClass.lc_name === "function" && (typeof parentClass.lc_name !== "function" || serializableClass.lc_name() !== parentClass.lc_name());
  if (lcNameIsSubclassed) {
    return serializableClass.lc_name();
  } else {
    return serializableClass.name;
  }
}
class Serializable {
  /**
   * The name of the serializable. Override to provide an alias or
   * to preserve the serialized module name in minified environments.
   *
   * Implemented as a static method to support loading logic.
   */
  static lc_name() {
    return this.name;
  }
  /**
   * The final serialized identifier for the module.
   */
  get lc_id() {
    return [
      ...this.lc_namespace,
      get_lc_unique_name(this.constructor)
    ];
  }
  /**
   * A map of secrets, which will be omitted from serialization.
   * Keys are paths to the secret in constructor args, e.g. "foo.bar.baz".
   * Values are the secret ids, which will be used when deserializing.
   */
  get lc_secrets() {
    return void 0;
  }
  /**
   * A map of additional attributes to merge with constructor args.
   * Keys are the attribute names, e.g. "foo".
   * Values are the attribute values, which will be serialized.
   * These attributes need to be accepted by the constructor as arguments.
   */
  get lc_attributes() {
    return void 0;
  }
  /**
   * A map of aliases for constructor args.
   * Keys are the attribute names, e.g. "foo".
   * Values are the alias that will replace the key in serialization.
   * This is used to eg. make argument names match Python.
   */
  get lc_aliases() {
    return void 0;
  }
  constructor(kwargs, ..._args) {
    Object.defineProperty(this, "lc_serializable", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "lc_kwargs", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this.lc_kwargs = kwargs || {};
  }
  toJSON() {
    if (!this.lc_serializable) {
      return this.toJSONNotImplemented();
    }
    if (
      // eslint-disable-next-line no-instanceof/no-instanceof
      this.lc_kwargs instanceof Serializable || typeof this.lc_kwargs !== "object" || Array.isArray(this.lc_kwargs)
    ) {
      return this.toJSONNotImplemented();
    }
    const aliases = {};
    const secrets = {};
    const kwargs = Object.keys(this.lc_kwargs).reduce((acc, key) => {
      acc[key] = key in this ? this[key] : this.lc_kwargs[key];
      return acc;
    }, {});
    for (let current = Object.getPrototypeOf(this); current; current = Object.getPrototypeOf(current)) {
      Object.assign(aliases, Reflect.get(current, "lc_aliases", this));
      Object.assign(secrets, Reflect.get(current, "lc_secrets", this));
      Object.assign(kwargs, Reflect.get(current, "lc_attributes", this));
    }
    Object.keys(secrets).forEach((keyPath) => {
      let read = this;
      let write = kwargs;
      const [last, ...partsReverse] = keyPath.split(".").reverse();
      for (const key of partsReverse.reverse()) {
        if (!(key in read) || read[key] === void 0)
          return;
        if (!(key in write) || write[key] === void 0) {
          if (typeof read[key] === "object" && read[key] != null) {
            write[key] = {};
          } else if (Array.isArray(read[key])) {
            write[key] = [];
          }
        }
        read = read[key];
        write = write[key];
      }
      if (last in read && read[last] !== void 0) {
        write[last] = write[last] || read[last];
      }
    });
    return {
      lc: 1,
      type: "constructor",
      id: this.lc_id,
      kwargs: mapKeys(Object.keys(secrets).length ? replaceSecrets(kwargs, secrets) : kwargs, keyToJson, aliases)
    };
  }
  toJSONNotImplemented() {
    return {
      lc: 1,
      type: "not_implemented",
      id: this.lc_id
    };
  }
}
function getEnvironmentVariable(name) {
  var _a;
  try {
    return typeof process !== "undefined" ? (
      // eslint-disable-next-line no-process-env
      (_a = process.env) == null ? void 0 : _a[name]
    ) : void 0;
  } catch (e) {
    return void 0;
  }
}
class BaseCallbackHandlerMethodsClass {
}
class BaseCallbackHandler extends BaseCallbackHandlerMethodsClass {
  get lc_namespace() {
    return ["langchain_core", "callbacks", this.name];
  }
  get lc_secrets() {
    return void 0;
  }
  get lc_attributes() {
    return void 0;
  }
  get lc_aliases() {
    return void 0;
  }
  /**
   * The name of the serializable. Override to provide an alias or
   * to preserve the serialized module name in minified environments.
   *
   * Implemented as a static method to support loading logic.
   */
  static lc_name() {
    return this.name;
  }
  /**
   * The final serialized identifier for the module.
   */
  get lc_id() {
    return [
      ...this.lc_namespace,
      get_lc_unique_name(this.constructor)
    ];
  }
  constructor(input) {
    super();
    Object.defineProperty(this, "lc_serializable", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "lc_kwargs", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "ignoreLLM", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "ignoreChain", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "ignoreAgent", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "ignoreRetriever", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "ignoreCustomEvent", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "raiseError", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false
    });
    Object.defineProperty(this, "awaitHandlers", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: getEnvironmentVariable("LANGCHAIN_CALLBACKS_BACKGROUND") !== "true"
    });
    this.lc_kwargs = input || {};
    if (input) {
      this.ignoreLLM = input.ignoreLLM ?? this.ignoreLLM;
      this.ignoreChain = input.ignoreChain ?? this.ignoreChain;
      this.ignoreAgent = input.ignoreAgent ?? this.ignoreAgent;
      this.ignoreRetriever = input.ignoreRetriever ?? this.ignoreRetriever;
      this.ignoreCustomEvent = input.ignoreCustomEvent ?? this.ignoreCustomEvent;
      this.raiseError = input.raiseError ?? this.raiseError;
      this.awaitHandlers = this.raiseError || (input._awaitHandler ?? this.awaitHandlers);
    }
  }
  copy() {
    return new this.constructor(this);
  }
  toJSON() {
    return Serializable.prototype.toJSON.call(this);
  }
  toJSONNotImplemented() {
    return Serializable.prototype.toJSONNotImplemented.call(this);
  }
  static fromMethods(methods) {
    class Handler extends BaseCallbackHandler {
      constructor() {
        super();
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: uuid__namespace.v4()
        });
        Object.assign(this, methods);
      }
    }
    return new Handler();
  }
}
class TraceClient {
  constructor(config) {
    this.socket = null;
    this.connected = false;
    this.eventQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.batchTimer = null;
    this.config = {
      batchInterval: 100,
      batchSize: 50,
      debug: false,
      projectName: "default",
      endpoint: "http://localhost:8000",
      ...config
    };
    this.connect();
  }
  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      this.socket = socket_ioClient.io(this.config.endpoint, {
        auth: {
          apiKey: this.config.apiKey,
          projectName: this.config.projectName
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1e3
      });
      this.socket.on("connect", () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.log("✅ Connected to trace backend");
        this.flushQueue();
      });
      this.socket.on("disconnect", () => {
        this.connected = false;
        this.log("⚠️  Disconnected from trace backend");
      });
      this.socket.on("connect_error", (error) => {
        this.reconnectAttempts++;
        this.log(`❌ Connection error: ${error.message}`);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.log(
            "⚠️  Max reconnection attempts reached. Events will be queued."
          );
        }
      });
      this.socket.on("error", (error) => {
        this.log(`❌ Socket error: ${error}`);
      });
      this.startBatchTimer();
    } catch (error) {
      this.log(`❌ Failed to create socket: ${error}`);
    }
  }
  /**
   * Send event to backend
   */
  async sendEvent(event) {
    this.eventQueue.push(event);
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushQueue();
    }
    return Promise.resolve();
  }
  /**
   * Start batch timer to flush events periodically
   */
  startBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.batchTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushQueue();
      }
    }, this.config.batchInterval);
  }
  /**
   * Flush queued events to server
   */
  flushQueue() {
    if (this.eventQueue.length === 0) return;
    const events = [...this.eventQueue];
    this.eventQueue = [];
    if (this.connected && this.socket) {
      this.socket.emit("trace_events", events);
      this.log(`📤 Sent ${events.length} events`);
    } else {
      this.eventQueue.unshift(...events);
      this.log(`⏳ Queued ${events.length} events (not connected)`);
    }
  }
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this.flushQueue();
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
  /**
   * Get queue size
   */
  getQueueSize() {
    return this.eventQueue.length;
  }
  /**
   * Debug logging
   */
  log(message) {
    if (this.config.debug) {
      console.log(`[AgentTrace] ${message}`);
    }
  }
}
class EventSerializer {
  /**
   * Serialize LLM result
   */
  static serializeLLMResult(result) {
    var _a, _b;
    const generations = result.generations[0];
    const response = ((_a = generations == null ? void 0 : generations[0]) == null ? void 0 : _a.text) || "";
    const tokenUsage = ((_b = result.llmOutput) == null ? void 0 : _b.tokenUsage) || {};
    const tokens = {
      prompt: tokenUsage.promptTokens || 0,
      completion: tokenUsage.completionTokens || 0,
      total: tokenUsage.totalTokens || 0
    };
    return { response, tokens };
  }
  /**
   * Serialize serialized object (model info, etc)
   */
  static serializeSerialized(serialized) {
    var _a;
    return {
      type: String(serialized.lc || "unknown"),
      name: ((_a = serialized.id) == null ? void 0 : _a[serialized.id.length - 1]) || "unknown",
      params: ("kwargs" in serialized ? serialized.kwargs : {}) || {}
    };
  }
  /**
   * Serialize tool input (can be string or object)
   */
  static serializeToolInput(input) {
    if (typeof input === "string") {
      return input;
    }
    try {
      return JSON.parse(JSON.stringify(input));
    } catch (error) {
      return String(input);
    }
  }
  /**
   * Calculate cost based on tokens and model
   */
  static calculateCost(model, tokens) {
    const pricing = {
      "gpt-4": { input: 0.03, output: 0.06 },
      "gpt-4-turbo": { input: 0.01, output: 0.03 },
      "gpt-3.5-turbo": { input: 15e-4, output: 2e-3 },
      "claude-3-opus": { input: 0.015, output: 0.075 },
      "claude-3-sonnet": { input: 3e-3, output: 0.015 },
      "claude-3-haiku": { input: 25e-5, output: 125e-5 }
    };
    const rates = pricing[model] || pricing["gpt-3.5-turbo"];
    return tokens.prompt / 1e3 * rates.input + tokens.completion / 1e3 * rates.output;
  }
  /**
   * Extract model name from serialized data
   */
  static extractModelName(serialized) {
    const params = ("kwargs" in serialized ? serialized.kwargs : {}) || {};
    return params.model_name || params.model || "unknown";
  }
  /**
   * Safely stringify error
   */
  static serializeError(error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }
}
class TracingCallbackHandler extends BaseCallbackHandler {
  constructor(config) {
    super();
    this.name = "agent_trace_handler";
    this.runDataMap = /* @__PURE__ */ new Map();
    this.config = {
      endpoint: (config == null ? void 0 : config.endpoint) || "http://localhost:8000",
      projectName: (config == null ? void 0 : config.projectName) || "default",
      debug: (config == null ? void 0 : config.debug) || false,
      ...config
    };
    this.client = new TraceClient(this.config);
    this.traceId = uuid.v4();
    if (this.config.debug) {
      console.log(`[AgentTrace] Started trace: ${this.traceId}`);
    }
  }
  /**
   * Called when LLM starts running
   */
  async handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata) {
    const serialized = EventSerializer.serializeSerialized(llm);
    const model = EventSerializer.extractModelName(llm);
    this.runDataMap.set(runId, {
      runId,
      parentRunId,
      nodeType: "llm",
      startTime: Date.now(),
      status: "running",
      data: {
        model,
        prompts,
        serialized
      }
    });
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId,
      timestamp: Date.now(),
      type: "llm_start",
      model,
      prompts,
      invocationParams: extraParams,
      metadata: {
        ...this.config.metadata,
        ...metadata,
        tags
      }
    };
    await this.client.sendEvent(event);
  }
  /**
   * Called when LLM ends running
   */
  async handleLLMEnd(output, runId) {
    const runData = this.runDataMap.get(runId);
    if (!runData) {
      console.error(`[AgentTrace] No run data found for ${runId}`);
      return;
    }
    const endTime = Date.now();
    const latency = endTime - runData.startTime;
    const { response, tokens } = EventSerializer.serializeLLMResult(output);
    const cost = EventSerializer.calculateCost(runData.data.model, tokens);
    runData.endTime = endTime;
    runData.status = "complete";
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "llm_end",
      response,
      tokens,
      cost,
      latency
    };
    await this.client.sendEvent(event);
  }
  /**
   * Called when tool starts running
   */
  async handleToolStart(tool, input, runId, parentRunId, tags, metadata) {
    const serialized = EventSerializer.serializeSerialized(tool);
    const toolName = serialized.name;
    this.runDataMap.set(runId, {
      runId,
      parentRunId,
      nodeType: "tool",
      startTime: Date.now(),
      status: "running",
      data: {
        toolName,
        input
      }
    });
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId,
      timestamp: Date.now(),
      type: "tool_start",
      toolName,
      input: EventSerializer.serializeToolInput(input),
      metadata: {
        ...this.config.metadata,
        ...metadata,
        tags
      }
    };
    await this.client.sendEvent(event);
  }
  /**
   * Called when tool ends running
   */
  async handleToolEnd(output, runId) {
    const runData = this.runDataMap.get(runId);
    if (!runData) {
      console.error(`[AgentTrace] No run data found for ${runId}`);
      return;
    }
    const endTime = Date.now();
    const latency = endTime - runData.startTime;
    runData.endTime = endTime;
    runData.status = "complete";
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "tool_end",
      toolName: runData.data.toolName,
      output,
      latency
    };
    await this.client.sendEvent(event);
  }
  /**
   * Called when chain starts running
   */
  async handleChainStart(chain, inputs, runId, parentRunId, tags, metadata) {
    const serialized = EventSerializer.serializeSerialized(chain);
    const chainName = serialized.name;
    this.runDataMap.set(runId, {
      runId,
      parentRunId,
      nodeType: "chain",
      startTime: Date.now(),
      status: "running",
      data: {
        chainName,
        inputs
      }
    });
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId,
      timestamp: Date.now(),
      type: "chain_start",
      chainName,
      inputs,
      metadata: {
        ...this.config.metadata,
        ...metadata,
        tags
      }
    };
    await this.client.sendEvent(event);
  }
  /**
   * Called when chain ends running
   */
  async handleChainEnd(outputs, runId) {
    const runData = this.runDataMap.get(runId);
    if (!runData) {
      console.error(`[AgentTrace] No run data found for ${runId}`);
      return;
    }
    const endTime = Date.now();
    const latency = endTime - runData.startTime;
    runData.endTime = endTime;
    runData.status = "complete";
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "chain_end",
      chainName: runData.data.chainName,
      outputs,
      latency
    };
    this.client.sendEvent(event);
  }
  /**
   * Called when an error occurs
   */
  async handleLLMError(error, runId) {
    await this.handleError(error, runId);
  }
  async handleToolError(error, runId) {
    await this.handleError(error, runId);
  }
  async handleChainError(error, runId) {
    await this.handleError(error, runId);
  }
  async handleError(error, runId) {
    const runData = this.runDataMap.get(runId);
    if (runData) {
      runData.status = "error";
    }
    const { message, stack } = EventSerializer.serializeError(error);
    const event = {
      eventId: uuid.v4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData == null ? void 0 : runData.parentRunId,
      timestamp: Date.now(),
      type: "error",
      error: message,
      stack
    };
    await this.client.sendEvent(event);
  }
  /**
   * Get trace ID
   */
  getTraceId() {
    return this.traceId;
  }
  /**
   * Check if connected to backend
   */
  isConnected() {
    return this.client.isConnected();
  }
  /**
   * Cleanup and disconnect
   */
  async cleanup() {
    this.client.disconnect();
    this.runDataMap.clear();
  }
}
function createTracer(config) {
  return new TracingCallbackHandler(config);
}
exports.EventSerializer = EventSerializer;
exports.TraceClient = TraceClient;
exports.TracingCallbackHandler = TracingCallbackHandler;
exports.createTracer = createTracer;
//# sourceMappingURL=index.cjs.map
