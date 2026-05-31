import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 3 — R&D by source (filled in P3.3). */
export function Section3Sources({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-3">
      <SectionDivider
        eyebrow="Section 3 · Sources"
        title="Where the money came from"
        dek="Composition of total R&D across six funding sources, over time."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.3.</p>
    </section>
  );
}
