import { useState } from 'react';
import { ChainContext } from '@jswork/react-hook-pipeline/src';

/**
 * Injects `loading` and `setLoading` state into props.
 */
export default function useLoading<
  T extends { loading?: boolean; setLoading?: (v: boolean) => void },
>(props: T, _chain: ChainContext<T>): T {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading } as T;
}
