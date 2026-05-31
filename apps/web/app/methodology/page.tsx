import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export const metadata = {
  title: 'Methodology',
  description: 'Sources, entity resolution, reconciliation methods, and documented caveats.',
};

export default function MethodologyPage() {
  return (
    <div className="container-narrow py-10 md:py-14 space-y-10">
      <PageHeader
        eyebrow="About this dashboard"
        title="Methodology"
        description="What's in the data, how it was joined, and what to be careful about."
      />

      <section className="space-y-4">
        <h2 className="h-section">Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SourceCard
            name="HERD"
            agency="NCSES"
            url="https://ncses.nsf.gov/surveys/higher-education-research-development/"
            desc="Annual self-reported R&D expenditures from U.S. universities. The 'top-down' source."
          />
          <SourceCard
            name="USAspending"
            agency="Treasury/OMB"
            url="https://www.usaspending.gov/"
            desc="Federal contract + assistance awards. Includes pro-rated period-of-performance allocation to fiscal years."
          />
          <SourceCard
            name="NIH ExPORTER"
            agency="NIH"
            url="https://exporter.nih.gov/"
            desc="NIH project-level awards. Includes funding IC, PI, project title, dates, cost."
          />
          <SourceCard
            name="NSF Awards"
            agency="NSF"
            url="https://www.nsf.gov/awardsearch/"
            desc="NSF award-level data. Includes obligations by FY and award mechanism."
          />
          <SourceCard
            name="SBIR.gov"
            agency="SBA"
            url="https://www.sbir.gov/"
            desc="Small Business Innovation Research + Small Business Technology Transfer awards (universities mostly via STTR)."
          />
          <SourceCard
            name="Federal Funds"
            agency="NCSES"
            url="https://ncses.nsf.gov/surveys/federal-funds-research-development/"
            desc="Agency-reported R&D obligations + outlays, used for the bridge reconciliation (Sheet 11)."
          />
          <SourceCard
            name="BLS CPI-U"
            agency="BLS"
            url="https://www.bls.gov/cpi/"
            desc="Consumer Price Index for All Urban Consumers. Used for real-dollar conversion (FY2024 base)."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Entity resolution</h2>
        <p className="text-text-secondary">
          A single canonical institution graph joins records across sources using a layered clustering approach
          (L0a/L0b/L0c). The graph handles parent-child relationships (e.g., UC system → individual UC campuses, Texas
          A&amp;M system → TAMU/TAMU-CC/etc.) as well as renamings, mergers, and joint operations like JHU APL. Federal
          labs and FFRDCs are intentionally <em>not</em> aggregated into their host university unless explicitly funded
          that way.
        </p>
        <p className="text-text-secondary">
          As of the latest build, the canonical graph has{' '}
          <strong className="text-text-primary">1,014 HERD universities</strong> and many additional related entities
          (FFRDCs, system offices, etc.).
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Reconciliation</h2>
        <p className="text-text-secondary">
          The top-down view (HERD's federal-share-of-R&amp;D-expenditures) and the bottom-up view (sum of USAS contracts
          + USAS assistance + NIH + NSF) <em>do not match</em>, by design. The gap reflects real definitional and scope
          differences across sources, not data errors. See{' '}
          <a className="text-accent hover:underline" href="/reconciliation/">
            Cross-Source Reconciliation
          </a>{' '}
          for the per-institution and national-level views.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Documented caveats</h2>
        <Card>
          <CardContent className="space-y-4 text-sm">
            <Caveat title="USAS coverage pre-FY2008 is sparse">
              USAspending.gov starts comprehensive reporting in FY2008. Pre-2008 USAS values may understate actual
              contract/assistance flows.
            </Caveat>
            <Caveat title="NSF pi_sk null rate ~62.6%">
              Phase D fact_nsf_award builder couldn't populate PI surrogate keys from nsf_id for 62% of NSF records.
              Cross-agency PI count (Sheet 8) underreports as a result.
            </Caveat>
            <Caveat title="Sheet 6 has 38 fully-duplicate rows">
              Pre-existing in fact_sbir.parquet from SBIR.gov source data. Same firm+program+phase+FY+amount appearing
              twice. These are SBIR.gov re-listings or duplicate registrations.
            </Caveat>
            <Caveat title="Sheet 7 tiny anchors flagged">
              89 institutions with cumulative HERD federal R&amp;D under $1M are flagged as is_tiny_anchor. Their
              bottom-up vs HERD deltas are not meaningful.
            </Caveat>
            <Caveat title="Sheet 10 source-table-family inconsistency">
              Federal Funds tab003 (agency totals) ≠ Σ agency_x_performer (performer breakdown) for several FYs. Sheet
              10 absorbs this in synthetic_remainder rows.
            </Caveat>
            <Caveat title="HERD vs FF gap is negative post-FY2018">
              HERD-reported federal R&amp;D exceeds Federal Funds explicit obligations after 2018. This is documented in
              Sheet 11 (federal_university_bridge).
            </Caveat>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Three data landmines</h2>
        <p className="text-text-secondary">
          Three structural quirks in the source data shape what this dashboard can — and cannot — say.
          They are surfaced here because every analyst working with federal R&amp;D data eventually trips on
          them.
        </p>
        <Card>
          <CardContent className="space-y-4 text-sm">
            <Caveat title="Vol 70 → Vol 71 taxonomy break (FY2015–FY2016)">
              NCSES Federal Funds switched obligation taxonomies between Vol&nbsp;70 (through FY2015) and
              Vol&nbsp;71 (FY2016 onward). Many agency categories were renamed and a few sub-agency rollups
              changed parents. National NSF Federal Funds totals are flagged at the year level so charts can
              indicate the discontinuity; per-institution streams (HERD Q09) do not carry this flag because
              HERD itself is internally consistent.
            </Caveat>
            <Caveat title="ARDES era — zero nonprofit dollars before FY2010">
              The Academic R&amp;D Expenditure Survey (ARDES) that preceded HERD did not break out
              nonprofit-source dollars at all. Source-of-funds rows where{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">source = 'nonprofit'</code> and{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fiscal_year &lt; 2010</code> are
              structurally zero — not missing, not suppressed, simply not asked for. Sections 3 and 7
              indicate the ARDES boundary where relevant.
            </Caveat>
            <Caveat title="USAS PIID collision">
              USASpending.gov keys contracts by{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">PIID</code> (procurement
              instrument identifier). PIIDs are reused across agencies and sometimes across years for
              modifications — collisions inflate naïve sum-by-PIID counts. The fact tables resolve this by
              aggregating award-level outlays from the underlying transactions, not by counting distinct
              PIIDs. Reconciliation deltas (§5) can still surface where the source-side join was imperfect.
            </Caveat>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Subject-area tagging</h2>
        <p className="text-text-secondary">
          Subject tags (AI, biomedical, materials, climate, quantum) come from
          regex matching against grant <em>titles</em> only — NSF and NIH abstracts are not in the source
          ledger, so the tagger sees only{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">project_title</code>. The patterns are
          intentionally conservative: a grant on "computational linguistics" without one of the listed
          keywords will not register as AI. Treat the tag counts as a directional, not exhaustive, signal.
        </p>
        <Card>
          <CardContent className="text-sm">
            <pre className="text-xs leading-relaxed overflow-x-auto">
{`SUBJECT_PATTERNS = {
  "AI":         r"\\b(artificial intelligence|machine learning|deep learning|
                  neural network|transformer|LLM|computer vision|NLP|
                  natural language processing)\\b",
  "biomedical": r"\\b(biomedical|biomedicine|therapeutic|clinical trial|
                  disease|cancer|immunology|oncology)\\b",
  "materials":  r"\\b(materials science|nanomaterial|polymer|composite|
                  alloy|semiconductor)\\b",
  "climate":    r"\\b(climate change|carbon|greenhouse|sustainability|
                  renewable|emission)\\b",
  "quantum":    r"\\b(quantum computing|quantum information|qubit|
                  quantum cryptography)\\b",
}`}
            </pre>
            <p className="text-text-secondary mt-3">
              Matching is case-insensitive (
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                regexp_matches(text, pattern, 'i')
              </code>{' '}
              in DuckDB). One grant can carry multiple tags. Tag dollar totals are computed by attributing
              the grant's full FY amount to every matching tag — overlap is intentional.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">PI deduplication</h2>
        <p className="text-text-secondary">
          Each principal investigator gets a stable surrogate key (
          <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code>) via a cross-walk that
          merges NIH PI Profile ID, NSF{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">nsf_id</code>, name string, and host
          institution. The cross-walk is conservative — two PIs with the same name at different
          institutions are kept separate. Phase D NSF builder couldn't populate{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code> for ~62.6% of NSF
          records (see caveats), so the union NIH+NSF PI count is a <strong>floor</strong>.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">What the PI counts mean.</strong> Section 6 (PI
              metrics) reports the distinct{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code> count from the
              top-20K NIH+NSF grants ledger, not the full universe. Counts are coverage floors — the
              true distinct-PI population is higher. This is good enough for trend and ranking analysis;
              treat absolute counts as lower bounds.
            </p>
            <p>
              <strong className="text-text-primary">What reconciliation compares.</strong> Section 5
              (HERD vs bottom-up streams) is{' '}
              <em>not</em> the Vol 70/71 reconciliation. It compares institution-reported HERD federal
              R&amp;D against the sum of NIH RePORTER + NSF Awards + USASpending contracts +
              USASpending assistance, year by year. Gaps reflect timing (expenditures vs obligations),
              sub-agency allocation methodology, and PIID resolution — see the Three data landmines
              section above.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">QA results</h2>
        <p className="text-text-secondary">
          Two independent QA passes signed off the underlying data: structural (Phase 13.5, 81 checks, 0 blockers) and
          value-accuracy (Phase 13.6, 2.7M cells scanned across 122 distinct value-level assertions, 0 blockers).
          Detailed findings live in the data-lake repo at{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">data/docs/qa_summary.md</code> and{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">data/docs/qa_value_summary.md</code>.
        </p>
      </section>

      <section className="space-y-4">
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
      </section>
    </div>
  );
}

function SourceCard({ name, agency, url, desc }: { name: string; agency: string; url: string; desc: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a className="hover:text-accent" href={url} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        </CardTitle>
        <div className="text-2xs uppercase tracking-wide text-text-tertiary">{agency}</div>
      </CardHeader>
      <CardContent className="text-sm text-text-secondary">{desc}</CardContent>
    </Card>
  );
}

function Caveat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-warning pl-4">
      <div className="font-medium text-warning">{title}</div>
      <p className="text-text-secondary mt-1">{children}</p>
    </div>
  );
}
