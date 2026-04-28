import { useState, useCallback, useMemo } from 'react';
import HookPipeline, {
  usePipeline,
  ProcessorHook,
  ChainContext,
} from '@jswork/react-hook-pipeline/src';

// ─── Enhancer Hooks ───

function useLoading<T extends { loading?: boolean; setLoading?: (v: boolean) => void }>(
  props: T,
  $chain: ChainContext<T>
): T {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading } as T;
}

function useAnalytics<T extends { onClick?: () => void }>(
  props: T,
  $chain: ChainContext<T>
): T {
  const track = useCallback(() => {
    console.log(`[Analytics] Click tracked at pipeline #${$chain.index}`);
    props.onClick?.();
  }, [props.onClick, $chain.index]);
  return { ...props, onClick: track } as T;
}

function useConfirm<T extends { onClick?: () => void; confirmMsg?: string }>(
  props: T,
  $chain: ChainContext<T>
): T {
  const confirmAndClick = useCallback(() => {
    if (window.confirm(props.confirmMsg || 'Are you sure?')) {
      props.onClick?.();
    }
  }, [props.onClick, props.confirmMsg]);
  return { ...props, onClick: confirmAndClick } as T;
}

function useCounter<T extends { count?: number; setCount?: (v: number) => void }>(
  props: T,
  $chain: ChainContext<T>
): T {
  const [count, setCount] = useState(props.count ?? 0);
  return { ...props, count, setCount } as T;
}

// ─── Target Components ───

interface ButtonProps {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  setLoading?: (v: boolean) => void;
  confirmMsg?: string;
}

function ActionButton({ label, onClick, loading, setLoading }: ButtonProps) {
  const pipeline = usePipeline<ButtonProps>();

  const handleClick = () => {
    setLoading?.(true);
    onClick?.();
    setTimeout(() => setLoading?.(false), 1500);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        className={`btn btn-sm ${loading ? 'btn-disabled' : 'btn-primary'}`}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-xs" />
        ) : null}
        {loading ? 'Saving...' : label}
      </button>
      <span className="badge badge-ghost badge-sm">
        {pipeline.totalProcessors} enhancers
      </span>
    </div>
  );
}

interface CounterProps {
  count: number;
  setCount?: (v: number) => void;
  label: string;
}

function CounterDisplay({ count, setCount, label }: CounterProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">{label}:</span>
      <div className="join">
        <button
          className="btn btn-sm join-item"
          onClick={() => setCount?.(count - 1)}
        >
          -
        </button>
        <span className="btn btn-sm join-item no-animation cursor-default">
          {count}
        </span>
        <button
          className="btn btn-sm join-item"
          onClick={() => setCount?.(count + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Dynamic enhancer config ───

type EnhancerPreset = 'none' | 'basic' | 'full' | 'confirm';

function getPresetEnhancers(preset: EnhancerPreset): ProcessorHook<ButtonProps>[] {
  switch (preset) {
    case 'none':
      return [];
    case 'basic':
      return [useLoading];
    case 'full':
      return [useLoading, useAnalytics];
    case 'confirm':
      return [useConfirm, useLoading, useAnalytics];
  }
}

// ─── App ───

function App() {
  const [preset, setPreset] = useState<EnhancerPreset>('full');
  const enhancers = useMemo(() => getPresetEnhancers(preset), [preset]);

  const handleSave = useCallback(() => {
    console.log('Save triggered!');
  }, []);

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">HookPipeline</h1>
          <p className="text-base-content/60 mt-2">
            Dynamically compose Hook-enabled enhancers via recursive rendering
          </p>
        </div>

        {/* ─── Demo 1: Dynamic Preset ─── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Dynamic Enhancer Chain</h2>
            <p className="text-sm text-base-content/60">
              Switch between presets to see how the same Target renders with different enhancer combinations.
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {(['none', 'basic', 'full', 'confirm'] as const).map((p) => (
                <button
                  key={p}
                  className={`btn btn-xs ${preset === p ? 'btn-active' : 'btn-outline'}`}
                  onClick={() => setPreset(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="divider" />

            <div className="flex items-center gap-4">
              <HookPipeline<ButtonProps>
                baseProps={{
                  label: 'Save',
                  onClick: handleSave,
                  confirmMsg: 'Confirm save changes?',
                }}
                enhancers={enhancers}
                Target={ActionButton}
                debug
              />
            </div>

            <div className="mt-2">
              <code className="text-xs bg-base-200 px-2 py-1 rounded">
                enhancers: [{enhancers.map((e) => e.name || '?').join(', ')}]
              </code>
            </div>
          </div>
        </div>

        {/* ─── Demo 2: Counter with useCounter enhancer ─── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Stateful Enhancer</h2>
            <p className="text-sm text-base-content/60">
              The <code>useCounter</code> enhancer injects <code>count</code> and <code>setCount</code> via useState.
            </p>

            <div className="divider" />

            <HookPipeline<CounterProps>
              baseProps={{ label: 'Score', count: 0 }}
              enhancers={[useCounter]}
              Target={CounterDisplay}
            />
          </div>
        </div>

        {/* ─── Demo 3: Error Boundary ─── */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Error Boundary</h2>
            <p className="text-sm text-base-content/60">
              When an enhancer throws, the fallback UI is rendered.
            </p>

            <div className="divider" />

            <HookPipeline<ButtonProps>
              baseProps={{ label: 'Broken' }}
              enhancers={[
                () => {
                  throw new Error('Something went wrong!');
                },
              ]}
              Target={ActionButton}
              fallback={
                <div className="alert alert-error alert-sm">
                  <span>Enhancer failed — fallback UI rendered.</span>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
