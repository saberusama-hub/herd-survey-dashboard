import { SectionDivider } from '@/components/editorial/SectionDivider';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/** Section 2 — Total R&D timeline (filled in P3.2). */
export function Section2TotalRD({ profile: _profile }: Props) {
  return (
    <section aria-labelledby="profile-section-2">
      <SectionDivider
        eyebrow="Section 2 · Total R&D"
        title="Twenty years of R&D expenditure"
        dek="Nominal dollars by default; toggle to FY2024-real to strip inflation."
      />
      <p className="text-sm text-text-tertiary">Coming in task P3.2.</p>
    </section>
  );
}
