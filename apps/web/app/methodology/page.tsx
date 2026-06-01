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
          <a className="text-accent underline underline-offset-2" href="/universities">
            Universities → §5 Reconciliation
          </a>{' '}
          on any institution profile, or the national view's{' '}
          <a className="text-accent underline underline-offset-2" href="/national#concentration">
            concentration section
          </a>
          .
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
        <h2 className="h-section">30-topic research taxonomy</h2>
        <p className="text-text-secondary">
          Section 7 of every profile and the <a className="text-accent hover:underline" href="/national#topics">/national #topics</a>{' '}
          panel use a 30-topic taxonomy applied to grant text. For NSF the matcher reads
          <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">awd_titl_txt</code>+
          <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">awd_abstr_narration</code> (full abstract text);
          for NIH it reads
          <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">project_title</code>+
          <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">project_terms</code>
          (structured MeSH-like terms). Topics are <strong>not</strong> mutually exclusive — a grant can match multiple,
          so the dollar shares can sum to more than 100%.
        </p>
        <Card>
          <CardContent className="text-sm">
            <pre className="text-xs leading-relaxed overflow-x-auto">
{`TOPICS = {
  "Artificial intelligence & ML":      \\b(artificial intelligence|machine learning|deep learning|
                                         neural network|transformer|large language model|LLM|
                                         reinforcement learning)\\b
  "Computer vision":                    \\b(computer vision|image recognition|object detection|
                                         visual recognition)\\b
  "Natural language processing":        \\b(natural language processing|NLP|language model|
                                         speech recognition|machine translation)\\b
  "Cancer research":                    \\b(cancer|oncology|tumor|carcinoma|malignan(t|cy)|
                                         metasta(sis|tic|sized))\\b
  "Neuroscience & brain":               \\b(neuroscience|brain|neural|neuro(n|nal)|cognitive|cortex)\\b
  "Cardiovascular":                     \\b(cardiovascular|cardiac|heart disease|coronary|
                                         stroke|hypertension)\\b
  "Infectious disease & vaccines":      \\b(infectious disease|virus|viral|bacteria(l)?|pathogen|
                                         vaccine|antimicrobial|pandemic)\\b
  "Immunology":                         \\b(immunology|immune|autoimmune|antibody|antigen|
                                         T cell|B cell)\\b
  "Genomics & genetics":                \\b(genom(e|ic|ics)|genetic|DNA|RNA sequenc|CRISPR|
                                         gene editing|gene therapy)\\b
  "Drug discovery & pharmacology":      \\b(drug discovery|pharmacolog|small molecule|
                                         therapeutic agent|medicinal chemistry)\\b
  "Mental health & psychiatry":         \\b(mental health|psychiatr|depression|anxiety|PTSD|
                                         schizophrenia|addiction|substance abuse)\\b
  "Aging & longevity":                  \\b(aging|longevity|Alzheimer|dementia|Parkinson|senescence)\\b
  "Diabetes & metabolic":               \\b(diabetes|obesity|metabolic|insulin)\\b
  "Regenerative medicine":              \\b(stem cell|regenerative medicine|tissue engineering)\\b
  "Bioengineering & synthetic biology": \\b(bioengineering|synthetic biology|biomanufacturing|
                                         bioreactor)\\b
  "Public health & epidemiology":       \\b(public health|epidemiolog|health disparit|health equity|
                                         population health)\\b
  "Quantum information":                \\b(quantum computing|quantum information|qubit|
                                         quantum cryptography|quantum sens)\\b
  "Materials science":                  \\b(materials science|polymer|composite|alloy|
                                         semiconductor|nanomaterial)\\b
  "Nanotechnology":                     \\b(nanotechnolog|nanoparticle|nanostructure|nanoscale)\\b
  "Climate & sustainability":           \\b(climate change|greenhouse|carbon dioxide|sustainability|
                                         decarbonization|emission)\\b
  "Renewable energy":                   \\b(solar|wind|geothermal|renewable energy|photovoltaic)\\b
  "Energy storage & batteries":         \\b(battery|lithium ion|energy storage|fuel cell)\\b
  "Cybersecurity":                      \\b(cybersecurity|cyber security|network security|
                                         cryptograph|encryption)\\b
  "Robotics & autonomy":                \\b(robot(ic|s)?|autonomous (vehicle|system)|
                                         self-driving|drone)\\b
  "Earth observation":                  \\b(remote sensing|satellite (data|imagery)|
                                         earth observation|geospatial)\\b
  "Astrophysics & cosmology":           \\b(astrophysic|cosmolog|galaxy|exoplanet|
                                         dark (matter|energy)|gravitational wave)\\b
  "Agriculture & food":                 \\b(agricultur|crop|soil|food security|
                                         sustainable agriculture)\\b
  "Water resources":                    \\b(water resource|hydrolog|watershed|
                                         drinking water|wastewater)\\b
  "Education research":                 \\b(STEM education|science education|curriculum|pedagog|
                                         teacher training|broadening participation)\\b
  "Social & behavioral science":        \\b(behavioral science|sociolog|economic policy|
                                         social network|inequality)\\b
}`}
            </pre>
            <p className="text-text-secondary mt-3">
              Matching is case-insensitive (
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                regexp_matches(text, pattern, 'i')
              </code>{' '}
              in DuckDB). One grant can carry multiple topics. Topic dollar totals attribute the grant's
              full FY amount to every matching topic — overlap is intentional. Patterns are intentionally
              conservative: a grant whose title and abstract never mention "machine learning" or
              "artificial intelligence" will not register under <em>AI &amp; ML</em>, even if the
              underlying method is ML.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Team-size methodology</h2>
        <p className="text-text-secondary">
          Section 6 of every profile and <a className="text-accent hover:underline" href="/national#team-size">/national #team-size</a>{' '}
          bucket every grant by the number of PIs on it. The bucketing is identical for NSF and NIH:
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">NSF</strong>: each award has one row in
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">fact_nsf_award</code>; the
              <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">n_pi</code> column counts the
              full team (lead + co-PIs). NSF does NOT store individual co-PI surrogate keys per row, only
              the lead PI's <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code>.
            </p>
            <p>
              <strong className="text-text-primary">NIH</strong>: each project has a row in
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project</code> AND
              one row per PI in
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project_pi_bridge</code>.
              Team size = <code className="text-xs bg-accent-muted/40 rounded px-1">COUNT(DISTINCT pi_sk) GROUP BY application_id</code>{' '}
              on the bridge.
            </p>
            <p>
              <strong className="text-text-primary">Buckets</strong>: <code className="text-xs bg-accent-muted/40 rounded px-1">1</code> (single PI),
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">2-5</code>, <code className="text-xs bg-accent-muted/40 rounded px-1">6-10</code>,
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">11-20</code>, <code className="text-xs bg-accent-muted/40 rounded px-1">21+</code>.
              Each grant's full FY $ goes to its team-size bucket (no sub-allocation).
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Federal-grants ↔ HERD-survey SK crosswalk</h2>
        <p className="text-text-secondary">
          The federal grants system (NSF Awards, NIH RePORTER) and the HERD survey use{' '}
          <em>different</em> institution surrogate keys for the same university. Johns Hopkins is{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">INST0000079</code> in NSF/NIH raw
          data and <code className="text-xs bg-accent-muted/40 rounded px-1">INST0001086</code> in the
          HERD panel — both rows live in the unified{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution</code>, but they
          never natural-join.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">Crosswalk method (priority order):</strong>
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>
                <strong>Self-identity</strong> — HERD sk already appears in NSF/NIH raw (884 of 1,014
                = 87.2% of HERD sks).
              </li>
              <li>
                <strong>UEI match</strong> — both sides have
                {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">primary_uei</code> in
                {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution</code>{' '}
                (catches a handful of UEI-tagged matches).
              </li>
              <li>
                <strong>IPEDS unitid match</strong> (catches a handful where IPEDS is populated).
              </li>
              <li>
                <strong>Normalized canonical_name + state match</strong> — lowercase, strip
                punctuation, drop suffix noise (<em>the</em>, <em>inc</em>, <em>university</em>,{' '}
                <em>college</em>). Picks up JHU and similar institutions where one row lacks UEI.
              </li>
            </ol>
            <p>
              <strong className="text-text-primary">Result</strong>: 899 of 1,014 HERD sks
              ({' '}<strong>88.7%</strong>) are matched to a federal-grants sk. The remaining 115
              unmatched are mostly small/historical institutions without UEI or IPEDS in
              dim_institution.
            </p>
            <p>
              The crosswalk is materialized as
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution_crosswalk.parquet</code>{' '}
              and is applied at aggregation time:
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">{`COALESCE(crosswalk.herd_sk, raw.institution_sk)`}</code>{' '}
              gives every NSF + NIH row a HERD-side SK when one exists.
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
              <strong className="text-text-primary">What the PI counts mean (Phase R, current).</strong>{' '}
              Section 6 reports the full federal-PI universe — every distinct{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code> with any NSF or
              NIH grant that fiscal year, summed across both agencies. NIH co-PIs come from
              {' '}<code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project_pi_bridge</code>
              {' '}(one row per project × PI); NSF contributes the lead PI per award. Counts include
              PIs at HERD-matched institutions plus federal-grants-only institutions that didn't match
              the crosswalk (their funding still appears in the national rollups, but the institutional
              profile shows only HERD-matched dollars).
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
