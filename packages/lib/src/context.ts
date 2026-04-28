import { createContext, useContext } from 'react';
import { PipelineState } from './types';

const PipelineContext = createContext<PipelineState<unknown> | null>(null);

/**
 * Access pipeline state from within a HookPipeline subtree.
 * Must be called inside a descendant of <HookPipeline>, otherwise throws.
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
