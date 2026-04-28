# HookPipeline Design Spec

## Overview

**Component name:** `HookPipeline`
**Package:** `@jswork/react-hook-pipeline`
**Purpose:** A React utility for dynamically composing Hook-enabled enhancers via type-safe recursive rendering.

Users write custom hooks as enhancers, and `HookPipeline` wraps each hook in a React component to satisfy Rules of Hooks, then chains them into a recursive rendering pipeline that flows props from first to last before rendering the target component.

## API Style

Declarative JSX:

```tsx
<HookPipeline
  baseProps={{ label: 'Save', onClick: save }}
  enhancers={[useLoading, useTooltip, useAnalytics]}
  Target={Button}
/>
```

## Type System

```ts
/** Processor Hook: receives current props + chain context, returns enhanced full props */
type ProcessorHook<T> = (props: T, $chain: ChainContext<T>) => T;

/** Chain context passed to each enhancer */
interface ChainContext<T> {
  index: number;           // Position in the enhancer chain (0-based)
  total: number;           // Total number of enhancers
  prev: T | null;          // Output of the previous enhancer (null for first)
  id: string;              // Identifier for debugging (function name or generated)
}

/** HookPipeline component props */
interface HookPipelineProps<T> {
  baseProps: T;                           // Initial props
  enhancers: ProcessorHook<T>[];          // Ordered enhancer hooks
  Target: React.ComponentType<T>;         // Final target component to render
  fallback?: React.ReactNode;             // Rendered when enhancers is empty (optional)
  debug?: boolean;                        // Enable debug logging
}

/** Return value of usePipeline() hook */
interface PipelineState<T> {
  currentIndex: number;
  totalProcessors: number;
  baseProps: T;
  currentProps: T;
  isLast: boolean;
}
```

### Type propagation

All enhancers share the same generic `T`. Enhancers that add fields constrain `T` via `extends`:

```ts
const useLoading = <T extends { loading?: boolean }>(
  props: T,
  $chain: ChainContext<T>
): T => {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading };
};
```

## Core Rendering Mechanism

### Architecture

```
HookPipeline (PipelineContext.Provider)
  └─ HookWrapper[0] (calls enhancers[0])
      └─ HookWrapper[1] (calls enhancers[1])
          └─ ...
              └─ <Target {...finalProps} />
```

### HookWrapper (internal component)

An internal recursive component that wraps each enhancer hook. Each HookWrapper instance calls exactly one hook inside its render, satisfying Rules of Hooks.

```tsx
const HookWrapper = <T,>({
  props,
  hook,
  $chain,
  children,
}: {
  props: T;
  hook: ProcessorHook<T>;
  $chain: ChainContext<T>;
  children: (enhancedProps: T) => React.ReactNode;
}) => {
  const enhanced = hook(props, $chain);
  return <>{children(enhanced)}</>;
};
```

### HookPipeline (main component)

```tsx
const HookPipeline = <T,>({
  baseProps,
  enhancers,
  Target,
  debug,
}: HookPipelineProps<T>) => {
  if (enhancers.length === 0) {
    return <Target {...baseProps} />;
  }

  const renderChain = (index: number, currentProps: T): React.ReactNode => {
    if (index >= enhancers.length) {
      return <Target {...currentProps} />;
    }

    const $chain: ChainContext<T> = {
      index,
      total: enhancers.length,
      prev: index > 0 ? currentProps : null,
      id: enhancers[index].name || `processor-${index}`,
    };

    return (
      <HookWrapper
        key={index}
        props={currentProps}
        hook={enhancers[index]}
        $chain={$chain}
      >
        {(next) => renderChain(index + 1, next)}
      </HookWrapper>
    );
  };

  return <>{renderChain(0, baseProps)}</>;
};
```

### Why this works with Rules of Hooks

- Each `HookWrapper` is a distinct React component with its own Hook call site
- The hook inside HookWrapper is called once per render, in the same order every time
- When `enhancers` array changes, affected HookWrapper instances re-mount (keyed by index), resetting their Hook state
- We do NOT call hooks in a loop/map/reduce — we create component instances that each call one hook

## $chain Context

Each enhancer receives a `ChainContext<T>` as its second argument, providing metadata about position in the pipeline.

Use cases:
- **Position-aware behavior:** `if ($chain.isLast) ...`
- **Access to previous output:** Compare `props` vs `$chain.prev` to detect what changed
- **Debug identification:** `$chain.id` shows which enhancer is running

## usePipeline() Hook

A React Context-based hook that allows any descendant of HookPipeline to access pipeline state.

```tsx
const PipelineContext = React.createContext<PipelineState<any> | null>(null);

function usePipeline<T>(): PipelineState<T> {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipeline must be used within a HookPipeline');
  return ctx as PipelineState<T>;
}
```

HookPipeline wraps its rendering tree in a `PipelineContext.Provider` that updates `currentProps` as the chain executes.

## Debug Mode

Activated via `debug` prop or `DEBUG=pipeline:*` environment variable.

In each HookWrapper, when debug is active:

```ts
if (debug) {
  const changed = Object.keys(enhanced).filter(
    (k) => enhanced[k] !== props[k]
  );
  console.log(
    `[HookPipeline] #${$chain.index} ${$chain.id}:`,
    changed.length ? `changed keys: ${changed.join(', ')}` : 'no change'
  );
}
```

## Example Enhancers

### useLoading

```tsx
const useLoading = <T extends object>(
  props: T,
  $chain: ChainContext<T>
): T & { loading: boolean; setLoading: (v: boolean) => void } => {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading };
};
```

### useTooltip

```tsx
const useTooltip = <T extends object>(
  props: T,
  $chain: ChainContext<T>
): T & { tooltip: { title: string; visible: boolean } } => {
  const [visible, setVisible] = useState(false);
  return { ...props, tooltip: { title: 'Click to action', visible } };
};
```

### useAnalytics

```tsx
const useAnalytics = <T extends { onClick?: () => void }>(
  props: T,
  $chain: ChainContext<T>
): T => {
  const track = useCallback(() => {
    console.log(`[Analytics] Button clicked at pipeline #${$chain.index}`);
    props.onClick?.();
  }, [props.onClick, $chain.index]);
  return { ...props, onClick: track };
};
```

### Usage

```tsx
<HookPipeline
  baseProps={{ label: 'Save', onClick: () => save() }}
  enhancers={[useLoading, useTooltip, useAnalytics]}
  Target={Button}
/>
```

## Edge Cases

| Scenario | Strategy |
|---|---|
| `enhancers` is empty array | Render `<Target {...baseProps} />` directly |
| `enhancers` exceeds 100 | Warn in dev, truncate to 100 |
| Hook returns `undefined`/`null` | Fall back to input props, warn in dev |
| `enhancers` changes at runtime | HookWrapper re-mounts (keyed by index), Hook state resets |
| Nested HookPipeline | Each has independent PipelineContext, no interference |
| `Target` not provided | Throw error in dev |
| Hook throws | Error boundary catches, render `fallback` if provided |

## File Structure

```
packages/lib/src/
  index.tsx              # Re-exports
  main.tsx               # HookPipeline component + HookWrapper + renderChain
  types.ts               # ProcessorHook, ChainContext, HookPipelineProps, PipelineState
  context.ts             # PipelineContext + usePipeline
  enhancers/             # Example enhancers (optional, could be in example app)
    use-loading.ts
    use-tooltip.ts
    use-analytics.ts
```

## Out of Scope (v1)

- Conditional injection (processor decides at runtime whether to activate)
- Async enhancers
- Middleware-style `(props, next) => ...` signature
- SSR-specific optimizations
