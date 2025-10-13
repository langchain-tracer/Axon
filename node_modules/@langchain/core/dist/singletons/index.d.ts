export interface AsyncLocalStorageInterface {
    getStore: () => any | undefined;
    run: <T>(store: any, callback: () => T) => T;
}
export declare class MockAsyncLocalStorage implements AsyncLocalStorageInterface {
    getStore(): any;
    run<T>(_store: any, callback: () => T): T;
}
declare class AsyncLocalStorageProvider {
    getInstance(): AsyncLocalStorageInterface;
    getRunnableConfig(): any;
    runWithConfig<T>(config: any, callback: () => T, avoidCreatingRootRunTree?: boolean): T;
    initializeGlobalInstance(instance: AsyncLocalStorageInterface): void;
}
declare const AsyncLocalStorageProviderSingleton: AsyncLocalStorageProvider;
export { AsyncLocalStorageProviderSingleton };
