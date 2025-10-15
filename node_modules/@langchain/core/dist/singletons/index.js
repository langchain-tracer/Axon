/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunTree } from "langsmith";
import { CallbackManager } from "../callbacks/manager.js";
export class MockAsyncLocalStorage {
    getStore() {
        return undefined;
    }
    run(_store, callback) {
        return callback();
    }
}
const mockAsyncLocalStorage = new MockAsyncLocalStorage();
const TRACING_ALS_KEY = Symbol.for("ls:tracing_async_local_storage");
const LC_CHILD_KEY = Symbol.for("lc:child_config");
class AsyncLocalStorageProvider {
    getInstance() {
        return globalThis[TRACING_ALS_KEY] ?? mockAsyncLocalStorage;
    }
    getRunnableConfig() {
        const storage = this.getInstance();
        // this has the runnable config
        // which means that we should also have an instance of a LangChainTracer
        // with the run map prepopulated
        return storage.getStore()?.extra?.[LC_CHILD_KEY];
    }
    runWithConfig(config, callback, avoidCreatingRootRunTree) {
        const callbackManager = CallbackManager._configureSync(config?.callbacks, undefined, config?.tags, undefined, config?.metadata);
        const storage = this.getInstance();
        const parentRunId = callbackManager?.getParentRunId();
        const langChainTracer = callbackManager?.handlers?.find((handler) => handler?.name === "langchain_tracer");
        let runTree;
        if (langChainTracer && parentRunId) {
            runTree = langChainTracer.convertToRunTree(parentRunId);
        }
        else if (!avoidCreatingRootRunTree) {
            runTree = new RunTree({
                name: "<runnable_lambda>",
                tracingEnabled: false,
            });
        }
        if (runTree) {
            runTree.extra = { ...runTree.extra, [LC_CHILD_KEY]: config };
        }
        return storage.run(runTree, callback);
    }
    initializeGlobalInstance(instance) {
        if (globalThis[TRACING_ALS_KEY] === undefined) {
            globalThis[TRACING_ALS_KEY] = instance;
        }
    }
}
const AsyncLocalStorageProviderSingleton = new AsyncLocalStorageProvider();
export { AsyncLocalStorageProviderSingleton };
