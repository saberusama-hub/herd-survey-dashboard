import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 4 — Federal funding by agency (filled in P3.4). */
export function Section4Agencies({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-4">
      <SectionDivider
        eyebrow="Section 4 · Federal agencies"
        title="Which federal agencies funded this university"
        dek="HERD Q09 institution-reported federal funding, by agency bucket."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.4.</p>
    </section>
  );
}
