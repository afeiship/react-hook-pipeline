import { useState, useCallback, useMemo } from 'react';
import HookPipeline, { ProcessorHook } from '@jswork/react-hook-pipeline/src';
import { useLoading, useAnalytics, useConfirm, useCounter } from './enhancers';
import ActionButton, { ButtonProps } from './components/ActionButton';
import CounterDisplay, { CounterProps } from './components/CounterDisplay';

type EnhancerPreset = 'none' | 'basic' | 'full' | 'confirm';

function getPresetEnhancers(preset: EnhancerPreset): ProcessorHook<ButtonProps>[] {
  switch (preset) {
    case 'none': return [];
    case 'basic': return [useLoading];
    case 'full': return [useLoading, useAnalytics];
    case 'confirm': return [useConfirm, useLoading, useAnalytics];
  }
}

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

        {/* Demo 1: Dynamic Enhancer Chain */}
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
                baseProps={{ label: 'Save', onClick: handleSave, confirmMsg: 'Confirm save changes?' }}
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

        {/* Demo 2: Stateful Enhancer */}
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

        {/* Demo 3: Error Boundary */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Error Boundary</h2>
            <p className="text-sm text-base-content/60">
              When an enhancer throws, the fallback UI is rendered.
            </p>

            <div className="divider" />

            <HookPipeline<ButtonProps>
              baseProps={{ label: 'Broken' }}
              enhancers={[() => { throw new Error('Something went wrong!'); }]}
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
