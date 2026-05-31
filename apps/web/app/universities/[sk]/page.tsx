import { notFound } from 'next/navigation';
import institutions from '@/public/data/dim_institution.json';

type Institution = { sk: string; name: string; state: string };

export async function generateStaticParams() {
  return (institutions as Institution[]).map((i) => ({ sk: i.sk }));
}

export default function UniversityProfilePage({ params }: { params: { sk: string } }) {
  const sk = params.sk;
  const match = (institutions as Institution[]).find((i) => i.sk === sk);
  if (!match) return notFound();
  return (
    <div className="container-wide py-10">
      <h1 className="text-3xl font-bold">{match.name}</h1>
      <p className="mt-2 text-text-secondary">
        {match.state} &middot; {sk} &middot; Profile coming in Phase P3.
      </p>
    </div>
  );
}
