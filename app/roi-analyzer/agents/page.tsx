import { CreatorAgentWorkflow } from "@/components/agents/CreatorAgentWorkflow";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CreatorAgentsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="CREATOR PICKS"
        subtitle="Agent-powered creator selection · investment recommendation"
        badge="ROI Analyzer"
      />

      <CreatorAgentWorkflow />
    </div>
  );
}
