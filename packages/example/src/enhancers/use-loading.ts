import { useState } from 'react';

/**
 * Injects `loading` and `setLoading` state into props.
 */
export default function useLoading<
  T extends { loading?: boolean; setLoading?: (v: boolean) => void },
>(props: T): T {
  const [loading, setLoading] = useState(false);
  return { ...props, loading, setLoading } as T;
}
