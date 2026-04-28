import { ComponentType, ReactNode } from 'react';

/**
 * A processor hook that receives current props and chain context,
 * returning the enhanced full props.
 * Each enhancer must return a complete T (spread original fields + new/overridden fields).
 */
export type ProcessorHook<T> = (props: T, $chain: ChainContext<T>) => T;

/**
 * Chain context metadata passed to each enhancer.
 */
export interface ChainContext<T> {
  /** Position of the current enhancer in the chain (0-based) */
  index: number;
  /** Total number of enhancers in the chain */
  total: number;
  /** Whether this is the last enhancer in the chain */
  isLast: boolean;
  /** Props received by this enhancer (equivalent to previous enhancer's output; null for the first) */
  prev: T | null;
  /** Identifier for debugging (function name or auto-generated) */
  id: string;
}

/**
 * Props for the HookPipeline component.
 */
export interface HookPipelineProps<T> {
  /** Initial props that flow through the entire enhancer chain */
  baseProps: T;
  /** Ordered array of enhancer hooks */
  enhancers: ProcessorHook<T>[];
  /** Target component to render after all enhancers have been applied */
  Target: ComponentType<T>;
  /** Fallback UI rendered when an enhancer throws an error */
  fallback?: ReactNode;
  /** Enable debug logging for each enhancer stage */
  debug?: boolean;
}

/**
 * Return type of the `usePipeline()` hook.
 */
export interface PipelineState<T> {
  /** Index of the currently executing enhancer */
  currentIndex: number;
  /** Total number of enhancers */
  totalProcessors: number;
  /** Original base props */
  baseProps: T;
  /** Current enhanced props */
  currentProps: T;
  /** Whether the pipeline has reached the last enhancer */
  isLast: boolean;
}
