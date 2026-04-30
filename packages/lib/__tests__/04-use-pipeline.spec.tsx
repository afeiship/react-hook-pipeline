/**
 * usePipeline Hook
 *
 * Verifies that usePipeline() provides correct pipeline state
 * to Target components and descendants, and throws when used
 * outside a HookPipeline tree.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HookPipeline, { usePipeline } from '../src';

describe('usePipeline()', () => {
  beforeAll(() => {
    process.stdout.write('\n  ℹ️  ⚠️  Error stack traces below are EXPECTED — testing usePipeline() guard clause.\n\n');
  });
  it('provides totalProcessors count in Target', () => {
    function TargetWithPipeline(props: { label: string }) {
      const pipeline = usePipeline<{ label: string }>();
      return (
        <div data-testid="target">
          {props.label} | total={pipeline.totalProcessors}
        </div>
      );
    }

    render(
      <HookPipeline
        baseProps={{ label: 'Demo' }}
        enhancers={[]}
        Target={TargetWithPipeline}
      />
    );

    expect(screen.getByTestId('target')).toHaveTextContent('Demo | total=0');
  });

  it('provides baseProps in pipeline state', () => {
    function InspectBaseProps(props: { label: string }) {
      const pipeline = usePipeline<{ label: string }>();
      return (
        <div data-testid="inspect">
          baseLabel={String(pipeline.baseProps.label)}
        </div>
      );
    }

    render(
      <HookPipeline
        baseProps={{ label: 'BaseCheck' }}
        enhancers={[]}
        Target={InspectBaseProps}
      />
    );

    expect(screen.getByTestId('inspect')).toHaveTextContent('baseLabel=BaseCheck');
  });

  it('throws when called outside HookPipeline', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      usePipeline();
      return <div />;
    }

    expect(() => render(<BadComponent />)).toThrow(
      /usePipeline must be used within a <HookPipeline>/
    );

    spy.mockRestore();
  });

  it('works with enhancers present', () => {
    function TargetWithState(props: { label: string }) {
      const pipeline = usePipeline<{ label: string }>();
      return (
        <div data-testid="with-enhancers">
          total={pipeline.totalProcessors}
        </div>
      );
    }

    const passthrough = <T,>(props: T): T => props;

    render(
      <HookPipeline
        baseProps={{ label: 'With' }}
        enhancers={[passthrough, passthrough]}
        Target={TargetWithState}
      />
    );

    expect(screen.getByTestId('with-enhancers')).toHaveTextContent('total=2');
  });
});
