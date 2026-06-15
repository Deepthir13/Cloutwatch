type PageHeaderProps = {
  title: string;
  subtitle: string;
  badge?: string;
};

export function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <header className="space-y-4">
      {badge ? (
        <span className="inline-flex rounded-full border border-green-dim bg-green-ghost px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
          {badge}
        </span>
      ) : null}

      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
          {subtitle}
        </p>
        <h1 className="text-4xl font-bold tracking-[-0.04em] text-green-primary [text-shadow:0_0_24px_rgba(26,255,102,0.28)]">
          {title}
        </h1>
      </div>
    </header>
  );
}
