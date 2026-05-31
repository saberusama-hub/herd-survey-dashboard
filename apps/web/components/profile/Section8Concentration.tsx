import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 8 — Concentration & volatility (filled in P3.8). */
export function Section8Concentration({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-8">
      <SectionDivider
        eyebrow="Section 8 · Concentration"
        title="How concentrated is this portfolio?"
        dek="Herfindahl–Hirschman, Shannon entropy, and year-over-year volatility — three lenses on diversification."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.8.</p>
    </section>
  );
}
