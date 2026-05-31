import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 9 — State context, peers, patents (filled in P3.9). */
export function Section9StateContext({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-9">
      <SectionDivider
        eyebrow="Section 9 · State context"
        title="In its state and among its peers"
        dek="Share of state R&D over time, similar-size peer institutions, and patent productivity."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.9.</p>
    </section>
  );
}
