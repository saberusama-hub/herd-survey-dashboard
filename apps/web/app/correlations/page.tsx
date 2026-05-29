import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata = { title: 'Correlation Builder' };

export default function CorrelationsPage() {
  return (
    <ComingSoon
      eyebrow="Correlations"
      title="Pick X, pick Y, see r"
      description="Scatter + regression + Pearson r + Spearman ρ across any two metrics, with sortable per-institution residual table. Auto-flags interesting outliers."
      plannedFor="Phase 2"
    />
  );
}
