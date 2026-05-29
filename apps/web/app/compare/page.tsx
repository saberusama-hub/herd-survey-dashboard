import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata = { title: 'Compare Institutions' };

export default function ComparePage() {
  return (
    <ComingSoon
      eyebrow="Compare"
      title="Side-by-side institution comparison"
      description="Pick up to 4 institutions; see their federal R&D portraits side-by-side. Bars, trends, agency mix small-multiples, reconciliation gaps."
      plannedFor="Phase 2"
    />
  );
}
