import { Component, useMemo, ReactNode } from 'react';
import { ChainContext, HookPipelineProps, PipelineState, ProcessorHook } from './types';
import { PipelineContext } from './context';

declare const process: { env?: { NODE_ENV?: string } } | undefined;

export { usePipeline } from './context';
export type { ProcessorHook, ChainContext, HookPipelineProps, PipelineState } from './types';

const CLASS_NAME = 'react-hook-pipeline';
const MAX_ENHANCERS = 100;

// ─── Internal Error Boundary (React requires a class component) ───

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class PipelineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[HookPipeline] Enhancer error:', error);
  }

  render() {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}

// ─── Internal HookWrapper: wraps each enhancer hook in a component ───

interface HookWrapperProps<T> {
  props: T;
  hook: ProcessorHook<T>;
  $chain: ChainContext<T>;
  debug?: boolean;
  children: (enhancedProps: T) => ReactNode;
}

function HookWrapper<T>({ props, hook, $chain, debug, children }: HookWrapperProps<T>) {
  let enhanced = hook(props, $chain);

  if (enhanced === undefined || enhanced === null) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn(
        `[HookPipeline] Enhancer "${$chain.id}" returned ${enhanced}. Falling back to input props.`
      );
    }
    enhanced = props;
  }

  if (debug) {
    const changed = Object.keys(enhanced as object).filter(
      (k) => (enhanced as Record<string, unknown>)[k] !== (props as Record<string, unknown>)[k]
    );
    console.log(
      `[HookPipeline] #${$chain.index} ${$chain.id}:`,
      changed.length ? `changed keys: ${changed.join(', ')}` : 'no change'
    );
  }

  return <>{children(enhanced)}</>;
}

// ─── Main HookPipeline component ───

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

  // Render Target directly when no enhancers (still wrap Provider for usePipeline support)
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

  // Recursively build the enhancer chain
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
