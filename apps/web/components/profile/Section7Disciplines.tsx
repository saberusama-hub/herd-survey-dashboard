import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 7 — Discipline mix (filled in P3.7). */
export function Section7Disciplines({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-7">
      <SectionDivider
        eyebrow="Section 7 · Disciplines"
        title="What research the money funded"
        dek="STEM share, field-of-science breakdown, and emerging-subject keyword tags."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.7.</p>
    </section>
  );
}
