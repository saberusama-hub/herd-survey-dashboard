import { notFound } from 'next/navigation';
import institutions from '@/public/data/dim_institution.json';

import { ProfileBody } from './ProfileBody';

type Institution = { sk: string; name: string; state: string };

export async function generateStaticParams() {
  return (institutions as Institution[]).map((i) => ({ sk: i.sk }));
}

export default function UniversityProfilePage({ params }: { params: { sk: string } }) {
  const sk = params.sk;
  const match = (institutions as Institution[]).find((i) => i.sk === sk);
  if (!match) return notFound();

  return (
    <div className="container-wide pt-10 pb-24 md:pt-14 md:pb-32">
      {/* ─── Hero header (static, server-rendered) ─── */}
      <header className="space-y-3 max-w-3xl">
        <p className="h-eyebrow text-accent">University profile</p>
        <h1 className="h-hero">{match.name}</h1>
        <p className="t-body-lg text-text-secondary">
          {match.state} &middot; <span className="tnum text-text-tertiary">{sk}</span>
        </p>
      </header>

      {/* ─── Long-scroll body (client — needs DuckDB-WASM) ─── */}
      <ProfileBody sk={sk} fallbackName={match.name} state={match.state} />
    </div>
  );
}
