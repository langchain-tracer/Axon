import { Client } from "../index.js";
import { ComparisonEvaluationResult as ComparisonEvaluationResultRow, Example, Run } from "../schemas.js";
import { evaluate } from "./index.js";
type ExperimentResults = Awaited<ReturnType<typeof evaluate>>;
export interface EvaluateComparativeOptions {
    /**
     * A list of evaluators to use for comparative evaluation.
     */
    evaluators: Array<(runs: Run[], example: Example) => ComparisonEvaluationResultRow | Promise<ComparisonEvaluationResultRow>>;
    /**
     * Randomize the order of outputs for each evaluation
     * @default false
     */
    randomizeOrder?: boolean;
    /**
     * The LangSmith client to use.
     * @default undefined
     */
    client?: Client;
    /**
     * Metadata to attach to the experiment.
     * @default undefined
     */
    metadata?: Record<string, unknown>;
    /**
     * A prefix to use for your experiment name.
     * @default undefined
     */
    experimentPrefix?: string;
    /**
     * A free-form description of the experiment.
     * @default undefined
     */
    description?: string;
    /**
     * Whether to load all child runs for the experiment.
     * @default false
     */
    loadNested?: boolean;
    /**
     * The maximum number of concurrent evaluators to run.
     * @default undefined
     */
    maxConcurrency?: number;
}
export interface ComparisonEvaluationResults {
    experimentName: string;
    results: ComparisonEvaluationResultRow[];
}
export declare function evaluateComparative(experiments: Array<string> | Array<Promise<ExperimentResults> | ExperimentResults>, options: EvaluateComparativeOptions): Promise<ComparisonEvaluationResults>;
export {};
