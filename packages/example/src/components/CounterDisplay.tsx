export interface CounterProps {
  count: number;
  setCount?: (v: number) => void;
  label: string;
}

export default function CounterDisplay({ count, setCount, label }: CounterProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">{label}:</span>
      <div className="join">
        <button className="btn btn-sm join-item" onClick={() => setCount?.(count - 1)}>
          -
        </button>
        <span className="btn btn-sm join-item no-animation cursor-default">{count}</span>
        <button className="btn btn-sm join-item" onClick={() => setCount?.(count + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
