/**
 * Basic Rendering
 *
 * Verifies that HookPipeline renders the Target component correctly
 * with zero, one, or multiple enhancers, and that baseProps flow
 * through the chain as expected.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';
import HookPipeline, { ProcessorHook, ChainContext } from '../src';

function Button({ label, loading, extra }: { label: string; loading?: boolean; extra?: string }) {
  return (
    <button disabled={loading}>
      {loading ? 'Loading...' : label}
      {extra && ` [${extra}]`}
    </button>
  );
}

function useExtra<T extends { extra?: string }>(props: T, $chain: ChainContext<T>): T {
  return { ...props, extra: `enhanced-by-${$chain.id}` } as T;
}

function useLoading<T extends { loading?: boolean }>(props: T, $chain: ChainContext<T>): T {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading } as T;
}

describe('basic rendering', () => {
  it('renders Target directly when enhancers is empty', () => {
    render(
      <HookPipeline baseProps={{ label: 'Click' }} enhancers={[]} Target={Button} />
    );
    expect(screen.getByText('Click')).toBeInTheDocument();
  });

  it('passes baseProps through a single enhancer', () => {
    render(
      <HookPipeline
        baseProps={{ label: 'Save', extra: '' }}
        enhancers={[useExtra]}
        Target={Button}
      />
    );
    expect(screen.getByText(/Save.*enhanced-by-useExtra/)).toBeInTheDocument();
  });

  it('passes baseProps through multiple enhancers', () => {
    render(
      <HookPipeline
        baseProps={{ label: 'Submit' }}
        enhancers={[useLoading, useExtra]}
        Target={Button}
      />
    );
    expect(screen.getByText(/Submit.*enhanced-by-useExtra/)).toBeInTheDocument();
  });

  it('renders Target with original props when enhancer is a passthrough', () => {
    const passthrough: ProcessorHook<{ label: string }> = (props) => props;
    render(
      <HookPipeline
        baseProps={{ label: 'Passthrough' }}
        enhancers={[passthrough]}
        Target={Button}
      />
    );
    expect(screen.getByText('Passthrough')).toBeInTheDocument();
  });
});
