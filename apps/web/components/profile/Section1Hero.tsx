import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
  state: string;
}

/** Section 1 — Hero KPI strip (filled in P3.1). */
export function Section1Hero({ profile: _profile, state: _state }: Props) {
  return (
    <section aria-labelledby="profile-section-1">
      <SectionDivider
        eyebrow="Section 1 · At a glance"
        title="Hero KPIs"
        dek="Four headline numbers that frame the rest of the profile."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.1.</p>
    </section>
  );
}
