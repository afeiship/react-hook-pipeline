import { ReactNode } from 'react';
import { ChainContext, ProcessorHook } from './types';

declare const process: { env?: { NODE_ENV?: string } } | undefined;

interface HookWrapperProps<T> {
  props: T;
  hook: ProcessorHook<T>;
  $chain: ChainContext<T>;
  debug?: boolean;
  children: (enhancedProps: T) => ReactNode;
}

/**
 * Renders a single enhancer hook inside its own component instance.
 *
 * Each {@link HookWrapper} invokes the provided hook with the current props and
 * chain context, validates the return value (falling back to the input props when
 * the hook returns `null` / `undefined`), optionally logs debug information, and
 * passes the enhanced props to the child render function.
 *
 * @internal This component is not part of the public API.
 */
export function HookWrapper<T>({ props, hook, $chain, debug, children }: HookWrapperProps<T>) {
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
