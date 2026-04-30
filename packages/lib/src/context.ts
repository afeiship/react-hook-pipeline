import { createContext, useContext } from 'react';
import { PipelineState } from './types';

const PipelineContext = createContext<PipelineState<unknown> | null>(null);

/**
 * Access the current pipeline state from within a {@link HookPipeline} subtree.
 *
 * Must be called inside a component rendered by `<HookPipeline>`,
 * otherwise an error is thrown.
 *
 * @typeParam T - The props type of the pipeline.
 * @returns The current {@link PipelineState}.
 *
 * @example
 * ```tsx
 * function MyEnhancer(props, $chain) {
 *   const pipeline = usePipeline<typeof props>();
 *   console.log(pipeline.totalProcessors);
 *   return props;
 * }
 * ```
 */
function usePipeline<T>(): PipelineState<T> {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error(
      '[HookPipeline] usePipeline must be used within a <HookPipeline> component'
    );
  }
  return ctx as PipelineState<T>;
}

export { PipelineContext, usePipeline };
