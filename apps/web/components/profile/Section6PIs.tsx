import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 6 — PI metrics (filled in P3.6). */
export function Section6PIs({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-6">
      <SectionDivider
        eyebrow="Section 6 · Principal investigators"
        title="The PI footprint"
        dek="Distinct federal PIs, average funding per PI, and how that funding spreads across the roster."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.6.</p>
    </section>
  );
}
