import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata = { title: 'Cross-Source Reconciliation' };

export default function ReconciliationPage() {
  return (
    <ComingSoon
      eyebrow="Reconciliation"
      title="Top-down vs Bottom-up"
      description="HERD-reported vs USAS+NIH+NSF-summed federal R&D per institution and at the national level. Includes the Option 3 Hybrid bridge from Sheet 11."
      plannedFor="Phase 2"
    />
  );
}
