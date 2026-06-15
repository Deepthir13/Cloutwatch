import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const modules = [
  {
    href: "/roi-analyzer",
    title: "ROI Analyzer",
    description: "Model projected creator performance and investment return.",
  },
  {
    href: "/meeting-notes",
    title: "Meeting Notes",
    description: "Extract decisions, risks, and follow-ups from creator calls.",
  },
  {
    href: "/pre-meeting-brief",
    title: "Pre-Meeting Brief",
    description: "Generate fast intelligence before creator conversations.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center gap-12">
      <PageHeader
        title="Cloutwatch"
        subtitle="Creator Investment Intelligence Platform"
        badge="Command Center"
      />

      <section className="grid gap-5 md:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group rounded-2xl border border-border-subtle bg-bg-card p-6 transition-colors hover:border-green-dim hover:bg-bg-elevated"
          >
            <p className="mb-4 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500 group-hover:text-green-primary">
              Module
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-grey-100">
              {module.title}
            </h2>
            <p className="mt-4 text-sm leading-6 text-grey-300">
              {module.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
