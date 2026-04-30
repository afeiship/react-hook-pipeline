import { useCallback } from 'react';
import { ChainContext } from '@jswork/react-hook-pipeline/src';

/**
 * Wraps `onClick` with a confirmation dialog before executing.
 */
export default function useConfirm<
  T extends { onClick?: () => void; confirmMsg?: string },
>(props: T, _chain: ChainContext<T>): T {
  const confirmAndClick = useCallback(() => {
    if (window.confirm(props.confirmMsg || 'Are you sure?')) {
      props.onClick?.();
    }
  }, [props.onClick, props.confirmMsg]);
  return { ...props, onClick: confirmAndClick } as T;
}
