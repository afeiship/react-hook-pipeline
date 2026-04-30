/**
 * $chain Context
 *
 * Verifies that each enhancer receives correct ChainContext metadata:
 * index, total, isLast, prev, and id.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HookPipeline, { ProcessorHook, ChainContext } from '../src';

function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

describe('$chain context', () => {
  it('provides correct index, total, and isLast for each enhancer', () => {
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
    expect(chains[0]).toMatchObject({ index: 0, total: 3, isLast: false });
    expect(chains[1]).toMatchObject({ index: 1, total: 3, isLast: false });
    expect(chains[2]).toMatchObject({ index: 2, total: 3, isLast: true });
  });

  it('sets prev to null for the first enhancer', () => {
    const captured: { prev: unknown }[] = [];

    const capturePrev: ProcessorHook<{ label: string }> = (props, $chain) => {
      captured.push({ prev: $chain.prev });
      return props;
    };

    render(
      <HookPipeline
        baseProps={{ label: 'P' }}
        enhancers={[capturePrev]}
        Target={Button}
      />
    );

    expect(captured[0].prev).toBeNull();
  });

  it('sets prev to the input props for non-first enhancers', () => {
    const captured: { prev: unknown }[] = [];

    const step1: ProcessorHook<{ label: string; tag?: string }> = (props) => ({
      ...props,
      tag: 'from-step1',
    });
    const step2: ProcessorHook<{ label: string; tag?: string }> = (props, $chain) => {
      captured.push({ prev: $chain.prev });
      return props;
    };

    render(
      <HookPipeline
        baseProps={{ label: 'Prev' }}
        enhancers={[step1, step2]}
        Target={Button}
      />
    );

    expect(captured[0].prev).toEqual({ label: 'Prev', tag: 'from-step1' });
  });

  it('uses function name as id for named enhancers', () => {
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

  it('generates processor-N as id for anonymous enhancers', () => {
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
