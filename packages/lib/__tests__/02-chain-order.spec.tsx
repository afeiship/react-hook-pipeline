/**
 * Chain Order
 *
 * Verifies that enhancers execute in the correct left-to-right order,
 * and that each enhancer receives the output of the previous one.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';
import HookPipeline, { ProcessorHook, ChainContext } from '../src';

function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

describe('chain order', () => {
  it('executes enhancers in array order', () => {
    const order: string[] = [];

    const step1: ProcessorHook<{ label: string }> = (props, $chain) => {
      order.push(`step-${$chain.index}`);
      return props;
    };
    const step2: ProcessorHook<{ label: string }> = (props, $chain) => {
      order.push(`step-${$chain.index}`);
      return props;
    };
    const step3: ProcessorHook<{ label: string }> = (props, $chain) => {
      order.push(`step-${$chain.index}`);
      return props;
    };

    render(
      <HookPipeline
        baseProps={{ label: 'Order' }}
        enhancers={[step1, step2, step3]}
        Target={Button}
      />
    );

    expect(order).toEqual(['step-0', 'step-1', 'step-2']);
  });

  it('passes output of one enhancer as input to the next', () => {
    const appendLabel =
      (suffix: string): ProcessorHook<{ label: string }> =>
      (props) => ({
        ...props,
        label: `${props.label}-${suffix}`,
      });

    render(
      <HookPipeline
        baseProps={{ label: 'A' }}
        enhancers={[appendLabel('B'), appendLabel('C')]}
        Target={Button}
      />
    );

    // A -> A-B -> A-B-C
    expect(screen.getByText('A-B-C')).toBeInTheDocument();
  });

  it('supports enhancer that uses useState', () => {
    function useToggle<T extends { toggled?: boolean }>(props: T): T {
      const [toggled] = useState(true);
      return { ...props, toggled } as T;
    }

    function ToggleButton({ label, toggled }: { label: string; toggled?: boolean }) {
      return <button>{toggled ? `${label} ON` : `${label} OFF`}</button>;
    }

    render(
      <HookPipeline
        baseProps={{ label: 'Switch' }}
        enhancers={[useToggle]}
        Target={ToggleButton}
      />
    );

    expect(screen.getByText('Switch ON')).toBeInTheDocument();
  });
});
