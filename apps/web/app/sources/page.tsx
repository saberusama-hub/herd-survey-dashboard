import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PARQUET_SOURCES } from '@/lib/data-sources';
import { SOURCES, type SourceId } from '@/lib/sources';

export const metadata = {
  title: 'Sources',
  description:
    'Every number on this dashboard traces to a federal raw data archive. The eight source datasets, their publishers, publication identifiers, raw-data downloads, and recipes for verifying any figure yourself.',
};

// Ordering: HERD first (most-used), then federal grant streams, then dims/deflator.
const SOURCE_ORDER: SourceId[] = [
  'ncses_herd',
  'ncses_federal_funds',
  'nih_exporter',
  'nsf_awards',
  'usaspending',
  'sbir_sttr',
  'ipeds',
  'bls_cpi_u',
];

export default function SourcesPage() {
  // Reverse-lookup: source_id → which parquets cite it.
  const parquetsBySource = new Map<SourceId, string[]>();
  for (const [name, prov] of Object.entries(PARQUET_SOURCES)) {
    for (const cite of prov.sources) {
      const arr = parquetsBySource.get(cite.id) ?? [];
      arr.push(name);
      parquetsBySource.set(cite.id, arr);
    }
  }

  return (
    <div className="container-narrow py-10 md:py-14 space-y-10">
      <PageHeader
        eyebrow="Source bibliography"
        title="Sources"
        description="Every chart, KPI, and number on this dashboard traces back to a federal raw data archive — not the dashboard's parquets, not the master Excel workbook, but the publisher's own data files. The eight datasets below are the ground truth."
      />

      <section className="space-y-3 text-sm text-text-secondary">
        <h2 className="h-section">How to verify any number on this site</h2>
        <ol className="list-decimal space-y-1.5 pl-6">
          <li>
            <strong className="text-text-primary">Find the citation on the chart.</strong> Every chart, KPI tile, and
            table has a "Source:" footer naming the publisher and the subset used (e.g., "NCSES HERD Survey · Q01
            Sources of Funds summed across all institutions for FY2024").
          </li>
          <li>
            <strong className="text-text-primary">Click through to the publisher's homepage.</strong> The shortName in
            the citation links to the publisher's landing page (e.g., NCSES HERD →{' '}
            <code className="rounded bg-accent-muted/40 px-1 text-xs">ncses.nsf.gov/...</code>).
          </li>
          <li>
            <strong className="text-text-primary">Follow "Raw data archive →"</strong> on the source card below to land
            on the actual download page.
          </li>
          <li>
            <strong className="text-text-primary">Use the "How to find the raw archive" recipe</strong> on each source
            card to navigate the publisher's site to the exact file(s) we ingested.
          </li>
          <li>
            <strong className="text-text-primary">Reproduce the calculation.</strong> Every chart's methodology panel
            (click the <span className="font-mono text-text-tertiary">?</span> next to the title) names the formula and
            filters used.
          </li>
        </ol>
        <p className="italic">
          Internal pipeline: federal raw archive → ETL → 41 parquet files in <code>apps/web/public/data/</code> → the
          dashboard. Citations on this site always point to step 1 (the federal raw archive), not the parquets.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="h-section">The eight datasets</h2>
        {SOURCE_ORDER.map((id) => {
          const s = SOURCES[id];
          const usedBy = parquetsBySource.get(id) ?? [];
          return <SourceDetail key={id} source={s} usedBy={usedBy} />;
        })}
      </section>

      <section className="space-y-3">
        <h2 className="h-section">Citation</h2>
        <Card>
          <CardContent className="text-sm font-mono">
            Policy and Strategy team (2026).{' '}
            <em>
              Research Data Platform: A longitudinal database of federal R&amp;D funding to U.S. universities,
              FY2005–FY2024
            </em>
            .
          </CardContent>
        </Card>
        <p className="text-[12px] italic text-text-tertiary">
          When citing values from this dashboard, please also cite the upstream federal source(s) listed above. The
          dashboard is a derivative work; the federal datasets are the primary record.
        </p>
      </section>
    </div>
  );
}

function SourceDetail({ source, usedBy }: { source: (typeof SOURCES)[SourceId]; usedBy: string[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <CardTitle>
            <a className="hover:text-accent" href={source.homeUrl} target="_blank" rel="noopener noreferrer">
              {source.shortName}
            </a>
          </CardTitle>
          <span className="text-[11px] uppercase tracking-wider text-text-tertiary">
            {source.publisherAcronym}
            {source.identifier && <span> · {source.identifier}</span>}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-secondary">{source.publisher}</p>
        <p className="mt-0.5 text-xs italic text-text-tertiary">{source.dataset}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-text-secondary">{source.description}</p>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <SourceField label="Coverage" value={source.coverage} />
          <SourceField label="Update cadence" value={source.cadence} />
          <SourceField label="License" value={source.license} />
          <SourceField label="Google query" value={source.googleQuery} mono />
        </dl>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Where to download the raw archive</p>
          <p className="text-text-secondary">{source.howToFindRaw}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={source.rawDataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
            >
              Raw data archive ↗
            </a>
            <a
              href={source.homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
            >
              Dataset homepage ↗
            </a>
            {source.apiUrl && (
              <a
                href={source.apiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
              >
                Public API ↗
              </a>
            )}
          </div>
        </div>

        {usedBy.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
              Used by {usedBy.length} parquet{usedBy.length === 1 ? '' : 's'} on this site
            </p>
            <p className="mt-1 text-[11px] text-text-tertiary">
              {usedBy.map((p, i) => (
                <span key={p}>
                  <code className="rounded bg-accent-muted/30 px-1 font-mono">{p}</code>
                  {i < usedBy.length - 1 && ', '}
                </span>
              ))}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-text-tertiary">{label}</dt>
      <dd className={`text-text-secondary ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
