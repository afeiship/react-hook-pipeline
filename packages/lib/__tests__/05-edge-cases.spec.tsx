/**
 * Edge Cases & Debug Mode
 *
 * Verifies error boundary behavior, undefined/null enhancer returns,
 * debug logging, and max enhancer warning.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HookPipeline, { ProcessorHook, ChainContext } from '../src';

function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

describe('edge cases', () => {
  beforeAll(() => {
    process.stdout.write('\n  ℹ️  💥  Error stack traces below are EXPECTED — testing error boundary and fallback behavior.\n\n');
  });
  it('renders fallback when enhancer throws', () => {
    const brokenEnhancer: ProcessorHook<{ label: string }> = () => {
      throw new Error('boom');
    };

    render(
      <HookPipeline
        baseProps={{ label: 'Broken' }}
        enhancers={[brokenEnhancer]}
        Target={Button}
        fallback={<div data-testid="fallback">Error occurred</div>}
      />
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByText('Broken')).not.toBeInTheDocument();
  });

  it('renders null when enhancer throws and no fallback is provided', () => {
    const brokenEnhancer: ProcessorHook<{ label: string }> = () => {
      throw new Error('boom');
    };

    const { container } = render(
      <HookPipeline
        baseProps={{ label: 'Broken' }}
        enhancers={[brokenEnhancer]}
        Target={Button}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('falls back to input props when enhancer returns undefined', () => {
    const undefinedEnhancer: ProcessorHook<{ label: string }> = () => undefined as any;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <HookPipeline
        baseProps={{ label: 'Safe' }}
        enhancers={[undefinedEnhancer]}
        Target={Button}
      />
    );

    expect(screen.getByText('Safe')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('falls back to input props when enhancer returns null', () => {
    const nullEnhancer: ProcessorHook<{ label: string }> = () => null as any;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <HookPipeline
        baseProps={{ label: 'NullSafe' }}
        enhancers={[nullEnhancer]}
        Target={Button}
      />
    );

    expect(screen.getByText('NullSafe')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('debug mode', () => {
  it('logs enhancer info when debug is true', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const tag: ProcessorHook<{ label: string; extra?: string }> = (props, $chain) => ({
      ...props,
      extra: `tagged-${$chain.index}`,
    });

    render(
      <HookPipeline
        baseProps={{ label: 'Debug' }}
        enhancers={[tag]}
        Target={Button}
        debug
      />
    );

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[HookPipeline]'),
      expect.stringContaining('changed keys')
    );

    spy.mockRestore();
  });

  it('does not log when debug is false or omitted', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const tag: ProcessorHook<{ label: string }> = (props) => props;

    render(
      <HookPipeline
        baseProps={{ label: 'Quiet' }}
        enhancers={[tag]}
        Target={Button}
      />
    );

    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining('[HookPipeline]'),
      expect.anything()
    );

    spy.mockRestore();
  });

  it('reports "no change" when enhancer does not modify props', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const passthrough: ProcessorHook<{ label: string }> = (props) => props;

    render(
      <HookPipeline
        baseProps={{ label: 'Same' }}
        enhancers={[passthrough]}
        Target={Button}
        debug
      />
    );

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[HookPipeline]'),
      'no change'
    );

    spy.mockRestore();
  });
});
