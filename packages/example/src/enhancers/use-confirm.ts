import { useCallback } from 'react';

/**
 * Wraps `onClick` with a confirmation dialog before executing.
 */
export default function useConfirm<
  T extends { onClick?: () => void; confirmMsg?: string },
>(props: T): T {
  const { onClick } = props;
  const confirmAndClick = useCallback(() => {
    if (window.confirm(props.confirmMsg || 'Are you sure?')) {
      onClick?.();
    }
  }, [onClick, props.confirmMsg]);
  return { ...props, onClick: confirmAndClick } as T;
}
