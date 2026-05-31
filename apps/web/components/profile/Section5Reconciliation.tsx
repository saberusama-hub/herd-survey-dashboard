import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 5 — HERD vs bottom-up federal streams (filled in P3.5). */
export function Section5Reconciliation({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-5">
      <SectionDivider
        eyebrow="Section 5 · Reconciliation"
        title="HERD vs bottom-up federal streams"
        dek="Institution-reported HERD federal R&D side-by-side with the sum of NIH + NSF + USASpending."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.5.</p>
    </section>
  );
}
