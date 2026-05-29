import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata = { title: 'NIH IC Deep Dive' };

export default function NihPage() {
  return (
    <ComingSoon
      eyebrow="NIH"
      title="Institute & Center Breakdown"
      description="Pick an IC (NCI, NIAID, NIGMS…) and see which universities dominate. 12,139 (institution × FY) rows in Sheet 12. MD Anderson hits 73.7% NCI."
      plannedFor="Phase 2"
    />
  );
}
