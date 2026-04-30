import { useState } from 'react';
import { ChainContext } from '@jswork/react-hook-pipeline/src';

/**
 * Injects `count` and `setCount` state into props.
 */
export default function useCounter<
  T extends { count?: number; setCount?: (v: number) => void },
>(props: T, _chain: ChainContext<T>): T {
  const [count, setCount] = useState(props.count ?? 0);
  return { ...props, count, setCount } as T;
}
