type ErrorCardProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle border-l-[3px] border-l-red-flag bg-bg-card p-5">
      <p className="text-sm font-semibold text-red-flag">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md border border-red-flag/60 bg-red-flag/10 px-4 py-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-red-flag transition-colors hover:bg-red-flag hover:text-bg-base"
      >
        Try again
      </button>
    </div>
  );
}
