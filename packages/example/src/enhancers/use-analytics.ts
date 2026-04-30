import { useCallback } from 'react';
import { ChainContext } from '@jswork/react-hook-pipeline/src';

/**
 * Wraps `onClick` with analytics tracking.
 */
export default function useAnalytics<T extends { onClick?: () => void }>(
  props: T,
  $chain: ChainContext<T>,
): T {
  const { onClick } = props;
  const track = useCallback(() => {
    console.log(`[Analytics] Click tracked at pipeline #${$chain.index}`);
    onClick?.();
  }, [onClick, $chain.index]);
  return { ...props, onClick: track } as T;
}
