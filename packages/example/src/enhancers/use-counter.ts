import { useState } from 'react';

/**
 * Injects `count` and `setCount` state into props.
 */
export default function useCounter<
  T extends { count?: number; setCount?: (v: number) => void },
>(props: T): T {
  const [count, setCount] = useState(props.count ?? 0);
  return { ...props, count, setCount } as T;
}
