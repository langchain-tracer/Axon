import { Client } from "../index.js";
import { Example, KVMap, Run, TracerSession } from "../schemas.js";
import { EvaluationResult, EvaluationResults, RunEvaluator } from "./evaluator.js";
type TargetT<TInput = any, TOutput = KVMap> = ((input: TInput, config?: KVMap) => Promise<TOutput>) | ((input: TInput, config?: KVMap) => TOutput) | {
    invoke: (input: TInput, config?: KVMap) => TOutput;
} | {
    invoke: (input: TInput, config?: KVMap) => Promise<TOutput>;
};
type DataT = string | AsyncIterable<Example> | Example[];
type SummaryEvaluatorT = ((runs: Array<Run>, examples: Array<Example>) => Promise<EvaluationResult | EvaluationResults>) | ((runs: Array<Run>, examples: Array<Example>) => EvaluationResult | EvaluationResults);
type EvaluatorT = RunEvaluator | ((run: Run, example?: Example) => EvaluationResult | EvaluationResults) | ((run: Run, example?: Example) => Promise<EvaluationResult | EvaluationResults>);
interface _ForwardResults {
    run: Run;
    example: Example;
}
interface _ExperimentManagerArgs {
    data?: DataT;
    experiment?: TracerSession | string;
    metadata?: KVMap;
    client?: Client;
    runs?: AsyncGenerator<Run>;
    evaluationResults?: AsyncGenerator<EvaluationResults>;
    summaryResults?: AsyncGenerator<(runsArray: Run[]) => AsyncGenerator<EvaluationResults, any, unknown>, any, unknown>;
    examples?: Example[];
    numRepetitions?: number;
    _runsArray?: Run[];
}
export interface EvaluateOptions {
    /**
     * The dataset to evaluate on. Can be a dataset name, a list of
     * examples, or a generator of examples.
     */
    data: DataT;
    /**
     * A list of evaluators to run on each example.
     * @default undefined
     */
    evaluators?: Array<EvaluatorT>;
    /**
     * A list of summary evaluators to run on the entire dataset.
     * @default undefined
     */
    summaryEvaluators?: Array<SummaryEvaluatorT>;
    /**
     * Metadata to attach to the experiment.
     * @default undefined
     */
    metadata?: KVMap;
    /**
     * A prefix to provide for your experiment name.
     * @default undefined
     */
    experimentPrefix?: string;
    /**
     * A free-form description of the experiment.
     */
    description?: string;
    /**
     * The maximum number of concurrent evaluations to run.
     * @default undefined
     */
    maxConcurrency?: number;
    /**
     * The LangSmith client to use.
     * @default undefined
     */
    client?: Client;
    /**
     * The number of repetitions to perform. Each example
     * will be run this many times.
     * @default 1
     */
    numRepetitions?: number;
}
export declare function evaluate(
/**
 * The target system or function to evaluate.
 */
target: TargetT, options: EvaluateOptions): Promise<ExperimentResults>;
interface ExperimentResultRow {
    run: Run;
    example: Example;
    evaluationResults: EvaluationResults;
}
/**
 * Manage the execution of experiments.
 *
 * Supports lazily running predictions and evaluations in parallel to facilitate
 * result streaming and early debugging.
 */
export declare class _ExperimentManager {
    _data?: DataT;
    _runs?: AsyncGenerator<Run>;
    _evaluationResults?: AsyncGenerator<EvaluationResults>;
    _summaryResults?: AsyncGenerator<(runsArray: Run[]) => AsyncGenerator<EvaluationResults, any, unknown>, any, unknown>;
    _examples?: Example[];
    _numRepetitions?: number;
    _runsArray?: Run[];
    client: Client;
    _experiment?: TracerSession;
    _experimentName: string;
    _metadata: KVMap;
    _description?: string;
    get experimentName(): string;
    getExamples(): Promise<Array<Example>>;
    setExamples(examples: Example[]): void;
    get datasetId(): Promise<string>;
    get evaluationResults(): AsyncGenerator<EvaluationResults>;
    get runs(): AsyncGenerator<Run>;
    constructor(args: _ExperimentManagerArgs);
    _getExperiment(): TracerSession;
    _getExperimentMetadata(): Promise<KVMap>;
    _createProject(firstExample: Example, projectMetadata: KVMap): Promise<TracerSession>;
    _getProject(firstExample: Example): Promise<TracerSession>;
    protected _printExperimentStart(): Promise<void>;
    start(): Promise<_ExperimentManager>;
    withPredictions(target: TargetT, options?: {
        maxConcurrency?: number;
    }): Promise<_ExperimentManager>;
    withEvaluators(evaluators: Array<EvaluatorT | RunEvaluator>, options?: {
        maxConcurrency?: number;
    }): Promise<_ExperimentManager>;
    withSummaryEvaluators(summaryEvaluators: Array<SummaryEvaluatorT>): Promise<_ExperimentManager>;
    getResults(): AsyncGenerator<ExperimentResultRow>;
    getSummaryScores(): Promise<EvaluationResults>;
    /**
     * Run the target function or runnable on the examples.
     * @param {TargetT} target The target function or runnable to evaluate.
     * @param options
     * @returns {AsyncGenerator<_ForwardResults>} An async generator of the results.
     */
    _predict(target: TargetT, options?: {
        maxConcurrency?: number;
    }): AsyncGenerator<_ForwardResults>;
    _runEvaluators(evaluators: Array<RunEvaluator>, currentResults: ExperimentResultRow, fields: {
        client: Client;
    }): Promise<ExperimentResultRow>;
    /**
     * Run the evaluators on the prediction stream.
     * Expects runs to be available in the manager.
     * (e.g. from a previous prediction step)
     * @param {Array<RunEvaluator>} evaluators
     * @param {number} maxConcurrency
     */
    _score(evaluators: Array<RunEvaluator>, options?: {
        maxConcurrency?: number;
    }): AsyncGenerator<ExperimentResultRow>;
    _applySummaryEvaluators(summaryEvaluators: Array<SummaryEvaluatorT>): AsyncGenerator<(runsArray: Run[]) => AsyncGenerator<EvaluationResults>>;
    _getDatasetVersion(): Promise<string | undefined>;
    _getDatasetSplits(): Promise<string[] | undefined>;
    _end(): Promise<void>;
}
/**
 * Represents the results of an evaluate() call.
 * This class provides an iterator interface to iterate over the experiment results
 * as they become available. It also provides methods to access the experiment name,
 * the number of results, and to wait for the results to be processed.
 */
declare class ExperimentResults implements AsyncIterableIterator<ExperimentResultRow> {
    private manager;
    results: ExperimentResultRow[];
    processedCount: number;
    summaryResults: EvaluationResults;
    constructor(experimentManager: _ExperimentManager);
    get experimentName(): string;
    [Symbol.asyncIterator](): AsyncIterableIterator<ExperimentResultRow>;
    next(): Promise<IteratorResult<ExperimentResultRow>>;
    processData(manager: _ExperimentManager): Promise<void>;
    get length(): number;
}
export {};
