import { useMemo, ReactNode } from 'react';
import { ChainContext, HookPipelineProps, PipelineState } from './types';
import { PipelineContext } from './context';
import { PipelineErrorBoundary } from './error-boundary';
import { HookWrapper } from './hook-wrapper';

declare const process: { env?: { NODE_ENV?: string } } | undefined;

const CLASS_NAME = 'react-hook-pipeline';
const MAX_ENHANCERS = 100;

/**
 * Compose multiple enhancer hooks into a rendering pipeline.
 *
 * `HookPipeline` takes a set of base props and an ordered list of enhancer functions,
 * then recursively renders each enhancer inside its own component boundary. Every
 * enhancer receives the current props and a {@link ChainContext} describing its position
 * in the chain, and must return the complete (possibly modified) props object for the
 * next stage. After all enhancers have run, the final props are spread onto the
 * {@link HookPipelineProps.Target} component.
 *
 * @typeParam T - The shape of the props object flowing through the pipeline.
 *
 * @example
 * ```tsx
 * <HookPipeline
 *   baseProps={{ count: 0, label: 'hello' }}
 *   enhancers={[doubleCount, uppercaseLabel]}
 *   Target={MyComponent}
 * />
 * ```
 */
function HookPipeline<T>({
  baseProps,
  enhancers,
  Target,
  fallback,
  debug,
}: HookPipelineProps<T>) {
  const pipelineState = useMemo<PipelineState<T>>(
    () => ({
      currentIndex: -1,
      totalProcessors: enhancers.length,
      baseProps,
      currentProps: baseProps,
      isLast: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enhancers.length, baseProps]
  );

  if (enhancers.length === 0) {
    return (
      <PipelineContext.Provider value={pipelineState}>
        <Target {...(baseProps as any)} />
      </PipelineContext.Provider>
    );
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' && enhancers.length > MAX_ENHANCERS) {
    console.warn(
      `[HookPipeline] ${enhancers.length} enhancers exceeds recommended maximum of ${MAX_ENHANCERS}.`
    );
  }

  const renderChain = (index: number, currentProps: T): ReactNode => {
    if (index >= enhancers.length) {
      return <Target {...(currentProps as any)} />;
    }

    const $chain: ChainContext<T> = {
      index,
      total: enhancers.length,
      isLast: index === enhancers.length - 1,
      prev: index > 0 ? currentProps : null,
      id: enhancers[index].name || `processor-${index}`,
    };

    return (
      <HookWrapper<T>
        key={`${index}-${$chain.id}`}
        props={currentProps}
        hook={enhancers[index]}
        $chain={$chain}
        debug={debug}
      >
        {(next) => renderChain(index + 1, next)}
      </HookWrapper>
    );
  };

  return (
    <PipelineContext.Provider value={pipelineState}>
      <PipelineErrorBoundary fallback={fallback}>
        {renderChain(0, baseProps)}
      </PipelineErrorBoundary>
    </PipelineContext.Provider>
  );
}

HookPipeline.displayName = CLASS_NAME;

export default HookPipeline;
