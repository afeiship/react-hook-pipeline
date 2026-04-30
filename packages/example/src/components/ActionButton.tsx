import { usePipeline } from '@jswork/react-hook-pipeline/src';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  setLoading?: (v: boolean) => void;
  confirmMsg?: string;
}

export default function ActionButton({ label, onClick, loading, setLoading }: ButtonProps) {
  const pipeline = usePipeline<ButtonProps>();

  const handleClick = () => {
    setLoading?.(true);
    onClick?.();
    setTimeout(() => setLoading?.(false), 1500);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        className={`btn btn-sm ${loading ? 'btn-disabled' : 'btn-primary'}`}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? <span className="loading loading-spinner loading-xs" /> : null}
        {loading ? 'Saving...' : label}
      </button>
      <span className="badge badge-ghost badge-sm">
        {pipeline.totalProcessors} enhancers
      </span>
    </div>
  );
}
