import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface Story {
  slug: string;
  eyebrow: string;
  title: string;
  blurb: string;
  paletteFrom: string;
  paletteTo: string;
  status?: 'live' | 'coming-soon';
}

const STORIES: Story[] = [
  {
    slug: 'self-funding',
    eyebrow: 'Story 1',
    title: 'The self-funding revolution',
    blurb:
      'Federal dollars used to underwrite the majority of U.S. university research. Institutions now do that themselves. Here is what changed, and what it cost the institutions that could not keep up.',
    paletteFrom: 'hsl(var(--cat-1))',
    paletteTo: 'hsl(var(--seq-3))',
  },
  {
    slug: 'three-crises',
    eyebrow: 'Story 2',
    title: 'Three crises in twenty years',
    blurb:
      'ARRA. The sequester. COVID-19. Each one drew a clean fingerprint into the timeline of federal R&D — and each agency wrote a different signature.',
    paletteFrom: 'hsl(var(--cat-2))',
    paletteTo: 'hsl(var(--div-pos-1))',
  },
  {
    slug: 'geography',
    eyebrow: 'Story 3',
    title: 'The geography of American science',
    blurb:
      'Federal research money moved on the map. Maryland tripled its share. The South Atlantic surged. Some Midwestern centers consolidated. Some collapsed.',
    paletteFrom: 'hsl(var(--cat-3))',
    paletteTo: 'hsl(var(--cat-5))',
  },
];

export function StoriesCarousel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {STORIES.map((s) => (
        <Link
          key={s.slug}
          href={`/story/${s.slug}`}
          className="group relative flex flex-col gap-4 rounded-lg border border-border bg-surface-elevated p-6 transition-all hover:border-accent hover:shadow-card-hover"
        >
          <div
            aria-hidden
            className="h-32 rounded-md"
            style={{
              background: `linear-gradient(135deg, ${s.paletteFrom} 0%, ${s.paletteTo} 100%)`,
              opacity: 0.85,
            }}
          />
          <div className="space-y-2">
            <p className="h-eyebrow text-accent">{s.eyebrow}</p>
            <h3 className="font-serif text-[1.375rem] font-semibold leading-tight tracking-tight text-text-primary">
              {s.title}
            </h3>
            <p className="t-small text-text-secondary leading-relaxed">{s.blurb}</p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-2xs font-medium text-accent">
            Read the story
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
