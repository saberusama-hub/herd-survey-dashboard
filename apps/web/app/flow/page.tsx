import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata = { title: 'Federal R&D Flow' };

export default function FlowPage() {
  return (
    <ComingSoon
      eyebrow="Federal flow"
      title="R&D Flow (Sankey)"
      description="Interactive Sankey of federal R&D flow: Federal → Agency → Performer type → Top institutions. Sheet 10 data, ~$199B in FY2024."
      plannedFor="Phase 2"
    />
  );
}
