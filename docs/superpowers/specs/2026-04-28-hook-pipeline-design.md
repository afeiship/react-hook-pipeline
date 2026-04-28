# HookPipeline Design Spec

## Overview

**Component name:** `HookPipeline`
**Package:** `@jswork/react-hook-pipeline`
**Purpose:** A React utility for dynamically composing Hook-enabled enhancers via type-safe recursive rendering.

Users write custom hooks as enhancers, and `HookPipeline` wraps each hook in a React component to satisfy Rules of Hooks, then chains them into a recursive rendering pipeline that flows props from first to last before rendering the target component.

### Naming Philosophy

**HookPipeline** was chosen to emphasize the **pipe** metaphor: data (props) flows left-to-right through each enhancer hook, transforming step by step, until it reaches the Target component. This mirrors the unix pipeline (`|`) model — each stage receives input, processes it, and passes output to the next. The "Hook" prefix signals that each stage is a custom React Hook, not a plain function or component.

Alternatives considered:
- **ComposeEnhancers** — emphasizes composition but obscures the directional flow
- **RenderStack** — implies LIFO (stack) which contradicts the left-to-right pipeline semantics
- **EffectLayer** — overemphasizes `useEffect`, but enhancers use all hooks (`useState`, `useMemo`, etc.)

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
  isLast: boolean;         // Whether this is the last enhancer in the chain
  prev: T | null;          // Props received by this enhancer (equivalent to previous enhancer's output; null for first)
  id: string;              // Identifier for debugging (function name or generated)
}

/** HookPipeline component props */
interface HookPipelineProps<T> {
  baseProps: T;                           // Initial props
  enhancers: ProcessorHook<T>[];          // Ordered enhancer hooks
  Target: React.ComponentType<T>;         // Final target component to render
  fallback?: React.ReactNode;             // Rendered when an enhancer throws
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

**Known limitation:** Type narrowing is per-enhancer via constraints; the pipeline does not statically track the accumulated type across all enhancers. The Target component's prop type `T` must include all fields added by all enhancers. This is inherent to the `T => T` signature — the return type cannot widen beyond the input constraint. Consumers should define a unified interface for the final enhanced props:

```ts
interface ButtonProps {
  label: string;
  onClick: () => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  tooltip: { title: string; visible: boolean };
}

<HookPipeline<ButtonProps>
  baseProps={{ label: 'Save', onClick: save }}
  enhancers={[useLoading, useTooltip]}
  Target={Button}
/>
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

**Note:** HookWrapper is intentionally NOT memoized because its `children` prop (a render function from `renderChain`) creates a new reference each render. Memoization would add overhead without benefit.

```tsx
const HookWrapper = <T,>({
  props,
  hook,
  $chain,
  children,
  debug,
}: {
  props: T;
  hook: ProcessorHook<T>;
  $chain: ChainContext<T>;
  debug?: boolean;
  children: (enhancedProps: T) => React.ReactNode;
}) => {
  const enhanced = hook(props, $chain) ?? props;

  if (enhanced === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[HookPipeline] Enhancer "${$chain.id}" returned undefined. Falling back to input props.`
      );
    }
  }

  if (debug) {
    const changed = Object.keys(enhanced as object).filter(
      (k) => (enhanced as any)[k] !== (props as any)[k]
    );
    console.log(
      `[HookPipeline] #${$chain.index} ${$chain.id}:`,
      changed.length ? `changed keys: ${changed.join(', ')}` : 'no change'
    );
  }

  return <>{children(enhanced)}</>;
};
```

### PipelineErrorBoundary (internal)

A class component error boundary required for catching enhancer runtime errors. This is the only class component in the library — React error boundaries fundamentally require `componentDidCatch`.

```tsx
class PipelineErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.error('[HookPipeline] Enhancer error:', error);
  }
  render() {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}
```

### HookPipeline (main component)

```tsx
const HookPipeline = <T,>({
  baseProps,
  enhancers,
  Target,
  fallback,
  debug,
}: HookPipelineProps<T>) => {
  const pipelineState = useMemo<PipelineState<T>>(() => ({
    currentIndex: -1,
    totalProcessors: enhancers.length,
    baseProps,
    currentProps: baseProps,
    isLast: false,
  }), [enhancers.length, baseProps]);

  // Guard: empty enhancers
  if (enhancers.length === 0) {
    return <Target {...baseProps} />;
  }

  // Guard: max depth (development only)
  if (process.env.NODE_ENV === 'development' && enhancers.length > 100) {
    console.warn(
      `[HookPipeline] ${enhancers.length} enhancers exceeds recommended maximum of 100. ` +
      `This may cause performance issues.`
    );
  }

  const renderChain = (index: number, currentProps: T): React.ReactNode => {
    if (index >= enhancers.length) {
      return <Target {...currentProps} />;
    }

    const $chain: ChainContext<T> = {
      index,
      total: enhancers.length,
      isLast: index === enhancers.length - 1,
      prev: index > 0 ? currentProps : null,
      id: enhancers[index].name || `processor-${index}`,
    };

    return (
      <HookWrapper
        key={`${index}-${enhancers[index].name || index}`}
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
};
```

**Migration note:** The existing `main.tsx` contains a class component placeholder (`ReactHookPipeline` extends `Component`). This will be fully replaced by the function component implementation above.

### Why this works with Rules of Hooks

- Each `HookWrapper` is a distinct React component with its own Hook call site
- The hook inside HookWrapper is called once per render, in the same order every time
- When `enhancers` array changes, affected HookWrapper instances re-mount (keyed by index + name), resetting their Hook state
- We do NOT call hooks in a loop/map/reduce — we create component instances that each call one hook

### Performance considerations

- **Memoize the `enhancers` array:** Consumers should use `useMemo` or a module-level constant to avoid creating new array references on every render. A new reference causes all HookWrappers to re-mount, resetting all hook state.
- **HookWrapper is not memoized:** Its `children` prop is a new render function each time, so memoization would add overhead without benefit.
- **Enhancers should use `useCallback`:** When enhancers create new functions (e.g., wrapped `onClick`), they should use `useCallback` to maintain referential stability.

## $chain Context

Each enhancer receives a `ChainContext<T>` as its second argument, providing metadata about position in the pipeline.

Use cases:
- **Position-aware behavior:** `if ($chain.isLast) ...` or `if ($chain.index === 0) ...`
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

**Note:** The cast to `PipelineState<T>` is unsafe — callers must ensure `T` matches the pipeline's actual props type. This is a documented tradeoff for the Context API's lack of generic support.

## Debug Mode

Activated via the `debug` prop. Debug logging is emitted from each HookWrapper, showing which keys changed at each pipeline stage.

Environment variable activation (`DEBUG=pipeline:*`) is deferred to implementation — it requires build-time replacement logic that depends on the consumer's bundler setup.

## Example Enhancers

### useLoading

```tsx
const useLoading = <T extends { loading?: boolean }>(
  props: T,
  $chain: ChainContext<T>
): T => {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading };
};
```

### useTooltip

```tsx
const useTooltip = <T extends object>(
  props: T,
  $chain: ChainContext<T>
): T => {
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
interface EnhancedButtonProps {
  label: string;
  onClick: () => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  tooltip: { title: string; visible: boolean };
}

<HookPipeline<EnhancedButtonProps>
  baseProps={{ label: 'Save', onClick: () => save() }}
  enhancers={[useLoading, useTooltip, useAnalytics]}
  Target={Button}
/>
```

## Edge Cases

| Scenario | Strategy |
|---|---|
| `enhancers` is empty array | Render `<Target {...baseProps} />` directly |
| `enhancers` exceeds 100 | Dev-mode warning (not truncated; consumer decides) |
| Hook returns `undefined`/`null` | Fall back to input props, dev-mode warning |
| Hook returns object missing keys | No runtime guard — TypeScript should catch this at compile time |
| `enhancers` changes at runtime | HookWrapper re-mounts (keyed by index + name), Hook state resets |
| `enhancers` reference changes but contents same | Consumer should memoize to avoid unnecessary re-mounts |
| `baseProps` is null/undefined | Dev-mode error thrown before rendering |
| Nested HookPipeline | Each has independent PipelineContext, no interference |
| `Target` not provided | TypeScript compile error; runtime throws descriptive error |
| Hook throws at runtime | PipelineErrorBoundary catches, renders `fallback` if provided |
| Duplicate enhancer functions | `$chain.id` may be duplicated; `index` serves as unique identifier |

## Exports

```ts
// Public API
export { HookPipeline, usePipeline };

// Types
export type { ProcessorHook, ChainContext, HookPipelineProps, PipelineState };
```

Internal (not exported): `HookWrapper`, `PipelineErrorBoundary`, `PipelineContext`.

## File Structure

```
packages/lib/src/
  index.tsx              # Re-exports public API
  main.tsx               # HookPipeline component + HookWrapper + PipelineErrorBoundary
  types.ts               # ProcessorHook, ChainContext, HookPipelineProps, PipelineState
  context.ts             # PipelineContext + usePipeline
```

Example enhancers (`useLoading`, `useTooltip`, `useAnalytics`) live in the `packages/example` app, not in the library — they are usage demonstrations, not library code.

## Comparison with Alternatives

### vs. Explicit Hook Calls

```tsx
// Explicit: each hook called directly in the component
function EnhancedButton(props) {
  const withLoading = useLoading(props);
  const withTooltip = useTooltip(withLoading);
  const withAnalytics = useAnalytics(withTooltip);
  return <Button {...withAnalytics} />;
}
```

**When to use explicit calls:** When the hook chain is static and known at compile time. Simpler, no abstraction overhead, full TypeScript inference.

**When to use HookPipeline:** When the hook chain is dynamic (determined at runtime by config/permissions), or when you need a unified pattern for composable enhancement across many components.

### vs. Pure Function `reduce`

```tsx
// DOES NOT WORK with hooks — violates Rules of Hooks
const finalProps = enhancers.reduce((props, fn) => fn(props), baseProps);
```

This approach is incompatible with hooks because `reduce` calls functions in a loop, violating the "don't call hooks in loops" rule. HookPipeline solves this by wrapping each hook in its own React component.

### vs. HOC Pattern

```tsx
const EnhancedButton = flowRight(withLoading, withTooltip, withAnalytics)(Button);
```

**When to use HOC:** When you need static composition at module level. Classic pattern, well-understood, but doesn't integrate naturally with hooks.

**When to use HookPipeline:** When enhancers need to be hooks (using `useState`, `useEffect`, etc.) and the chain is dynamic.

## Out of Scope (v1)

- Conditional injection (processor decides at runtime whether to activate)
- Async enhancers
- Middleware-style `(props, next) => ...` signature
- SSR-specific optimizations
- Environment variable-based debug activation
