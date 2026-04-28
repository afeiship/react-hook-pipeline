/**
 * HookPipeline 核心测试
 * 验证递归渲染、enhancer 链、$chain 上下文、usePipeline hook、调试模式、错误边界
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { useState, useCallback, useContext } from 'react';
import HookPipeline, { usePipeline, ProcessorHook, ChainContext } from '../src';

// ─── 测试用 Target 组件 ───

function Button({
  label,
  onClick,
  loading,
  extra,
}: {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  extra?: string;
}) {
  return (
    <button onClick={onClick} disabled={loading}>
      {loading ? 'Loading...' : label}
      {extra && ` [${extra}]`}
    </button>
  );
}

// ─── 测试用 enhancer hooks ───

function useLoading<T extends { loading?: boolean }>(
  props: T,
  $chain: ChainContext<T>
): T {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading } as T;
}

function useExtra<T extends { extra?: string }>(
  props: T,
  $chain: ChainContext<T>
): T {
  return { ...props, extra: `enhanced-by-${$chain.id}` } as T;
}

function useAnalytics<T extends { onClick?: () => void; trackLog?: string }>(
  props: T,
  $chain: ChainContext<T>
): T {
  const track = useCallback(() => {
    (props as Record<string, unknown>).trackLog = 'tracked';
    props.onClick?.();
  }, [props.onClick]);
  return { ...props, onClick: track } as T;
}

// ─── 测试 ───

describe('HookPipeline', () => {
  it('should render Target directly when enhancers is empty', () => {
    render(
      <HookPipeline
        baseProps={{ label: 'Click' }}
        enhancers={[]}
        Target={Button}
      />
    );
    expect(screen.getByText('Click')).toBeInTheDocument();
  });

  it('should pass baseProps through single enhancer', () => {
    render(
      <HookPipeline
        baseProps={{ label: 'Save', extra: '' }}
        enhancers={[useExtra]}
        Target={Button}
      />
    );
    expect(screen.getByText(/Save.*enhanced-by-useExtra/)).toBeInTheDocument();
  });

  it('should chain multiple enhancers in order', () => {
    const order: string[] = [];

    const enhancer1: ProcessorHook<{ label: string }> = (props, $chain) => {
      order.push(`step-${$chain.index}`);
      return props;
    };
    const enhancer2: ProcessorHook<{ label: string }> = (props, $chain) => {
      order.push(`step-${$chain.index}`);
      return props;
    };

    render(
      <HookPipeline
        baseProps={{ label: 'Test' }}
        enhancers={[enhancer1, enhancer2]}
        Target={Button}
      />
    );

    expect(order).toEqual(['step-0', 'step-1']);
  });

  it('should support enhancer with useState', () => {
    render(
      <HookPipeline
        baseProps={{ label: 'Submit' }}
        enhancers={[useLoading]}
        Target={Button}
      />
    );
    // loading 默认为 false，所以按钮应显示 label
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('should provide correct $chain metadata', () => {
    const chains: ChainContext<unknown>[] = [];

    const recorder: ProcessorHook<{ label: string }> = (props, $chain) => {
      chains.push({ ...$chain });
      return props;
    };

    render(
      <HookPipeline
        baseProps={{ label: 'X' }}
        enhancers={[recorder, recorder, recorder]}
        Target={Button}
      />
    );

    expect(chains).toHaveLength(3);
    expect(chains[0]).toMatchObject({ index: 0, total: 3, isLast: false, prev: null });
    expect(chains[1]).toMatchObject({ index: 1, total: 3, isLast: false });
    expect(chains[2]).toMatchObject({ index: 2, total: 3, isLast: true });
  });

  it('should allow usePipeline() in Target component', () => {
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

  it('should throw when usePipeline() is called outside HookPipeline', () => {
    // 抑制 console.error
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

  it('should log debug info when debug prop is true', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <HookPipeline
        baseProps={{ label: 'Debug' }}
        enhancers={[useExtra]}
        Target={Button}
        debug
      />
    );

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[HookPipeline]'),
      expect.any(String)
    );

    spy.mockRestore();
  });

  it('should render fallback when enhancer throws', () => {
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

  it('should fall back to input props when enhancer returns undefined', () => {
    const undefinedEnhancer: ProcessorHook<{ label: string }> = () => undefined as any;

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <HookPipeline
        baseProps={{ label: 'Safe' }}
        enhancers={[undefinedEnhancer]}
        Target={Button}
      />
    );

    // 应该用原始 props 渲染
    expect(screen.getByText('Safe')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('should generate id from enhancer function name', () => {
    const ids: string[] = [];

    const namedEnhancer: ProcessorHook<{ label: string }> = (props, $chain) => {
      ids.push($chain.id);
      return props;
    };

    render(
      <HookPipeline
        baseProps={{ label: 'ID' }}
        enhancers={[namedEnhancer]}
        Target={Button}
      />
    );

    expect(ids).toEqual(['namedEnhancer']);
  });

  it('should generate fallback id for anonymous enhancer', () => {
    const ids: string[] = [];

    render(
      <HookPipeline
        baseProps={{ label: 'ID' }}
        enhancers={[
          ((props: { label: string }, $chain: ChainContext<{ label: string }>) => {
            ids.push($chain.id);
            return props;
          }) as ProcessorHook<{ label: string }>,
        ]}
        Target={Button}
      />
    );

    expect(ids[0]).toMatch(/^processor-\d+$/);
  });
});
