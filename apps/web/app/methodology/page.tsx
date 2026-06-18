import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SOURCES, type SourceId } from '@/lib/sources';

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
        <p className="text-text-secondary">
          Every chart on this dashboard cites the underlying federal raw data archive in its footer. The list below is a
          quick reference — for the full bibliography with publication identifiers, raw-data download links, and "how to
          verify any number" recipes, see{' '}
          <a className="text-accent underline underline-offset-2" href="/sources">
            /sources
          </a>
          .
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              'ncses_herd',
              'usaspending',
              'nih_exporter',
              'nsf_awards',
              'sbir_sttr',
              'ncses_federal_funds',
              'uspto_patentsview',
              'nai_top100',
              'ipeds',
              'bls_cpi_u',
            ] as SourceId[]
          ).map((id) => (
            <SourceCard key={id} source={SOURCES[id]} />
          ))}
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
        <h2 className="h-section">Three data landmines</h2>
        <p className="text-text-secondary">
          Three structural quirks in the source data shape what this dashboard can — and cannot — say. They are surfaced
          here because every analyst working with federal R&amp;D data eventually trips on them.
        </p>
        <Card>
          <CardContent className="space-y-4 text-sm">
            <Caveat title="Vol 70 → Vol 71 taxonomy break (FY2015–FY2016)">
              NCSES Federal Funds switched obligation taxonomies between Vol&nbsp;70 (through FY2015) and Vol&nbsp;71
              (FY2016 onward). Many agency categories were renamed and a few sub-agency rollups changed parents.
              National NSF Federal Funds totals are flagged at the year level so charts can indicate the discontinuity;
              per-institution streams (HERD Q09) do not carry this flag because HERD itself is internally consistent.
            </Caveat>
            <Caveat title="ARDES era — zero nonprofit dollars before FY2010">
              The Academic R&amp;D Expenditure Survey (ARDES) that preceded HERD did not break out nonprofit-source
              dollars at all. Source-of-funds rows where{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">source = 'nonprofit'</code> and{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fiscal_year &lt; 2010</code> are structurally
              zero — not missing, not suppressed, simply not asked for. Sections 3 and 7 indicate the ARDES boundary
              where relevant.
            </Caveat>
            <Caveat title="USAS PIID collision">
              USASpending.gov keys contracts by <code className="text-xs bg-accent-muted/40 rounded px-1">PIID</code>{' '}
              (procurement instrument identifier). PIIDs are reused across agencies and sometimes across years for
              modifications — collisions inflate naïve sum-by-PIID counts. The fact tables resolve this by aggregating
              award-level outlays from the underlying transactions, not by counting distinct PIIDs. Reconciliation
              deltas (§5) can still surface where the source-side join was imperfect.
            </Caveat>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">30-topic research taxonomy</h2>
        <p className="text-text-secondary">
          Section 7 of every profile and the{' '}
          <a className="text-accent underline underline-offset-2" href="/national#topics">
            /national #topics
          </a>{' '}
          panel use a 30-topic taxonomy applied to grant text. For NSF the matcher reads
          <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">awd_titl_txt</code>+
          <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">awd_abstr_narration</code> (full abstract
          text); for NIH it reads
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
              <code className="text-xs bg-accent-muted/40 rounded px-1">regexp_matches(text, pattern, 'i')</code> in
              DuckDB). One grant can carry multiple topics. Topic dollar totals attribute the grant's full FY amount to
              every matching topic — overlap is intentional. Patterns are intentionally conservative: a grant whose
              title and abstract never mention "machine learning" or "artificial intelligence" will not register under{' '}
              <em>AI &amp; ML</em>, even if the underlying method is ML.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Team-size methodology</h2>
        <p className="text-text-secondary">
          Section 6 of every profile and{' '}
          <a className="text-accent underline underline-offset-2" href="/national#team-size">
            /national #team-size
          </a>{' '}
          bucket every grant by the number of PIs on it. The bucketing is identical for NSF and NIH:
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">NSF</strong>: each award has one row in{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nsf_award</code>; the
              <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">n_pi</code> column counts the full team
              (lead + co-PIs). NSF does NOT store individual co-PI surrogate keys per row, only the lead PI's{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code>.
            </p>
            <p>
              <strong className="text-text-primary">NIH</strong>: each project has a row in{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project</code> AND one row per PI in{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project_pi_bridge</code>. Team size ={' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                COUNT(DISTINCT pi_sk) GROUP BY application_id
              </code>{' '}
              on the bridge.
            </p>
            <p>
              <strong className="text-text-primary">Buckets</strong>:{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">1</code> (single PI),{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">2-5</code>,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">6-10</code>,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">11-20</code>,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">21+</code>. Each grant's full FY $ goes to its
              team-size bucket (no sub-allocation).
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">Federal-grants ↔ HERD-survey SK crosswalk</h2>
        <p className="text-text-secondary">
          The federal grants system (NSF Awards, NIH RePORTER) and the HERD survey use <em>different</em> institution
          surrogate keys for the same university. Johns Hopkins is{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">INST0000079</code> in NSF/NIH raw data and{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">INST0001086</code> in the HERD panel — both rows
          live in the unified <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution</code>, but they
          never natural-join.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">Crosswalk method (priority order):</strong>
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>
                <strong>Self-identity</strong> — HERD sk already appears in NSF/NIH raw (884 of 1,014 = 87.2% of HERD
                sks).
              </li>
              <li>
                <strong>UEI match</strong> — both sides have{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">primary_uei</code> in{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution</code> (catches a handful of
                UEI-tagged matches).
              </li>
              <li>
                <strong>IPEDS unitid match</strong> (catches a handful where IPEDS is populated).
              </li>
              <li>
                <strong>Normalized canonical_name + state match</strong> — lowercase, strip punctuation, drop suffix
                noise (<em>the</em>, <em>inc</em>, <em>university</em>, <em>college</em>). Picks up JHU and similar
                institutions where one row lacks UEI.
              </li>
            </ol>
            <p>
              <strong className="text-text-primary">Result</strong>: 899 of 1,014 HERD sks ( <strong>88.7%</strong>) are
              matched to a federal-grants sk. The remaining 115 unmatched are mostly small/historical institutions
              without UEI or IPEDS in dim_institution.
            </p>
            <p>
              The crosswalk is materialized as{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution_crosswalk.parquet</code> and is
              applied at aggregation time:{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                {'COALESCE(crosswalk.herd_sk, raw.institution_sk)'}
              </code>{' '}
              gives every NSF + NIH row a HERD-side SK when one exists.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" id="patents">
        <h2 className="h-section">USPTO patents — assignee crosswalk &amp; methodology</h2>
        <p className="text-text-secondary">
          The <a className="text-accent underline underline-offset-2" href="/patents">Patents</a> tab, Section 8 on every
          university profile, and the Patents &amp; IP metric group on <a className="text-accent underline underline-offset-2" href="/compare">/compare</a>{' '}
          all draw from the same source-of-truth aggregation:{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">sheet_13_ip_patents.parquet</code>. The data layer
          combines USPTO PatentsView (granted utility patents + pre-grant publications + the forward citation graph)
          with HERD R&amp;D denominators, calendar-year keyed (CY = patent grant year, not federal FY).
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-3">
            <p>
              <strong className="text-text-primary">Universe.</strong> CY2005–CY2025 granted utility patents from
              PatentsView (PVGPATDIS), plus pre-grant publications (PVPGPUBDIS) for applications-filed metrics and the
              full forward citation graph (PVANNUAL) for the 5-year mature-cohort citation average. CY2026 is excluded
              because it&apos;s a half-year cohort that bleeds in mid-build. 109,815 distinct utility patents map to{' '}
              <strong className="text-text-primary">471 HERD institutions</strong>.
            </p>
            <p>
              <strong className="text-text-primary">4-stage assignee → institution_sk crosswalk.</strong>
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>
                <strong>Appendix-B seeds</strong> — ~50 explicit hand-curated mappings for institutions whose USPTO
                assignee strings don&apos;t match HERD canonical names cleanly (e.g.,{' '}
                <em>Georgia Tech Research Corp</em> → Georgia Institute of Technology;{' '}
                <em>Ohio State Innovation Foundation</em> → Ohio State University). Highest precedence.
              </li>
              <li>
                <strong>Direct alias lookup</strong> against the dim_institution_aliases table for institutions with
                known short-form / acronym variants.
              </li>
              <li>
                <strong>Foundation / Regents / Trustees pattern strip</strong> — pattern matchers for{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">research foundation</code>,{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">innovation foundation</code>,{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">regents of</code>,{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">trustees of</code>,{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">argonne</code>,{' '}
                <code className="text-xs bg-accent-muted/40 rounded px-1">school of medicine</code>, and similar
                wrappers that USPTO uses for the legal entity holding the patent.
              </li>
              <li>
                <strong>Filtered fuzzy match</strong> — RapidFuzz WRatio ≥ 95 AND token-sort-ratio ≥ 88 AND ≥ 12 chars
                after wrapper strip AND ≥ 2 tokens AND US-org assignee_type only (
                <code className="text-xs bg-accent-muted/40 rounded px-1">{'{2, 6, 9, 12, 14, 15}'}</code>). Tight
                thresholds avoid false positives like Khalifa University → Missouri University of S&amp;T.
              </li>
            </ol>
            <p>
              <strong className="text-text-primary">Hard ID overrides (10).</strong> Some PatentsView assignee_ids have
              upstream disambiguation bugs we patch by explicit ID:{' '}
              <em>Penn State Research Foundation</em> (mis-classified as type=3 foreign by PatentsView; 1,248 patents
              were excluded under the strict filter and force-included via override), <em>Vanderbilt → VU proper</em>{' '}
              (not VUMC; 1,171 patents), <em>Texas A&amp;M System → College Station</em> (not West Texas A&amp;M;
              1,207 patents), plus 7 others. See{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">scripts/build_dim_assignee_to_institution.py</code>{' '}
              in the data-lake repo for the full ASSIGNEE_ID_OVERRIDES dict.
            </p>
            <p>
              <strong className="text-text-primary">System-flagship pinning (Option B).</strong> USPTO assigns patents to{' '}
              <em>legal entities</em>, which are often system-wide (Regents of the University of California; University
              of Colorado System; SUNY Research Foundation; Texas A&amp;M System; University of Maine System). HERD
              tracks individual campuses but has no system-level institution_sk. By design, these system-entity patents
              are absorbed by the system flagship campus:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[13px]">
              <li>Regents of the University of California → UC Berkeley (10,333 patents over CY2005-25)</li>
              <li>University of Colorado System → CU Boulder</li>
              <li>SUNY Research Foundation → SUNY Albany</li>
              <li>Texas A&amp;M System → Texas A&amp;M College Station</li>
              <li>University of Maine System → University of Maine</li>
            </ul>
            <p>
              Each pinned profile carries an inline amber caveat in Section 8 disclosing the pin. UCLA, UCSF, UC Davis,
              CU Denver, CU Anschutz, etc. report their own HERD R&amp;D under their own SK but legally hold no patents
              directly.
            </p>
            <p>
              <strong className="text-text-primary">Counting rule.</strong> Multi-assignee patents are{' '}
              <em>whole-counted</em> per assigned institution: a patent jointly owned by MIT and Harvard contributes 1
              to each. Cross-institution co-assignment is rare (&lt; 1% of university patents). Industry co-assignment
              (corporate non-government, non-university co-assignee on the same patent) is exposed separately as{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">co_industry_share</code>.
            </p>
            <p>
              <strong className="text-text-primary">Federal-funding flag.</strong> A patent is flagged{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">patents_granted_fed_funded</code> if its{' '}
              government-interest clause (mandated by the 1980 Bayh-Dole Act) names any federal agency. The flag is
              binary per patent — a patent with even one federal-source acknowledgement counts regardless of other
              non-federal funding sources.
            </p>
            <p>
              <strong className="text-text-primary">External verification.</strong> 89 institution × CY cells were
              compared against the National Academy of Inventors Top-100 published rankings (CY2013–CY2024). After two
              iterations of crosswalk patches:{' '}
              <strong className="text-text-primary">69 of 89 cells (78%)</strong> are within ±25% of NAI counts. The 20
              residuals decompose:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-[13px]">
              <li>
                <strong>7 small-delta methodology variance</strong> — Georgia Tech CY2014–21 (+27–36%) and Indiana
                CY2020 (+32%). All &lt; 20 absolute-patent deltas; commodity-DOD-patent counting differences.
              </li>
              <li>
                <strong>5 structural methodology divergence</strong> — NAI counts first-named-assignee only (pre-CY2022)
                or all-inventors (CY2022+); we count distinct-assignee whole-counting. Multi-assignee patents create
                systematic 0–30% variance for Northwestern, Harvard, Cornell, and ASU in flagged years.
              </li>
              <li>
                <strong>2 PatentsView upstream disambiguation bugs</strong> — Northeastern University (Boston) is
                tagged type=3 (foreign) in PatentsView, evidently conflated with Northeastern University in China. The
                only "Northeastern University" assignee_ids are not in the US-org universe; unfixable without a
                PatentsView correction or a manual override.
              </li>
              <li>
                <strong>6 out-of-scope institutions</strong> — Mayo Clinic, University of Advancing Technology,
                Harrisburg University, National University, Intellectual Properties Inc. appear in NAI but are outside
                the HERD ~1,014-institution universe. By design.
              </li>
            </ul>
            <p>
              Full reconciliation report:{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                data/docs/ip_verification_report_round2.md
              </code>{' '}
              in the data-lake repo.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" id="patent-caveats">
        <h2 className="h-section">Patent data — three reading caveats</h2>
        <p className="text-text-secondary">
          Same shape as the three federal-funding landmines above: structural quirks of the source data that shape what
          the patents tab can — and cannot — say.
        </p>
        <Card>
          <CardContent className="space-y-4 text-sm">
            <Caveat title="Pre-grant publication (PGPub) lag">
              Applications counts come from pre-grant publications, which USPTO releases ~18 months after the actual
              filing. CY2024 and CY2025 application counts are truncated — true filings continue to publish through
              ~mid-2026. The patents tab year table flags affected rows with a dagger (
              <code className="text-xs bg-accent-muted/40 rounded px-1">†</code>) and a footnote. Use CY2023 as the last
              fully-published applications cohort.
            </Caveat>
            <Caveat title="5-year forward citation maturation">
              The{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">avg_cites_5yr_mature</code> metric requires the
              full 5 calendar years after grant to accumulate citations. Only CYs ≤ 2020 have a fully matured 5-year
              window as of the latest build (December 2025). Later cohorts show truncation flags; downstream metrics
              (
              <code className="text-xs bg-accent-muted/40 rounded px-1">citations_truncated_5yr_flag</code>) are masked
              or labeled accordingly. The Patents tab&apos;s mature-cohort KPI pins to CY2020 for this reason.
            </Caveat>
            <Caveat title="NAI methodology divergence (counting rules)">
              The National Academy of Inventors&apos; Top-100 ranking uses{' '}
              <em>first-named assignee only</em> through CY2021 and switched to <em>all-inventors counting</em> in
              CY2022. Our aggregation uses{' '}
              <em>distinct-assignee whole-counting</em> consistently across years (a patent with multiple university
              assignees contributes 1 to each, every year). The methodologies systematically diverge by 0–30% on
              multi-assignee patents and produce the residual variance flagged in the Phase 3 verification report.
              Neither methodology is &ldquo;wrong&rdquo; — they answer different questions.
            </Caveat>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="h-section">PI deduplication</h2>
        <p className="text-text-secondary">
          Each principal investigator gets a stable surrogate key (
          <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code>) via a cross-walk that merges NIH PI
          Profile ID, NSF <code className="text-xs bg-accent-muted/40 rounded px-1">nsf_id</code>, name string, and host
          institution. The cross-walk is conservative — two PIs with the same name at different institutions are kept
          separate. Phase D NSF builder couldn't populate{' '}
          <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code> for ~62.6% of NSF records (see
          caveats), so the union NIH+NSF PI count is a <strong>floor</strong>.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">What the PI counts mean (Phase R, current).</strong> Section 6
              reports the full federal-PI universe — every distinct{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">pi_sk</code> with any NSF or NIH grant that
              fiscal year, summed across both agencies. NIH co-PIs come from{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project_pi_bridge</code> (one row per
              project × PI); NSF contributes the lead PI per award. Counts include PIs at HERD-matched institutions plus
              federal-grants-only institutions that didn't match the crosswalk (their funding still appears in the
              national rollups, but the institutional profile shows only HERD-matched dollars).
            </p>
            <p>
              <strong className="text-text-primary">What reconciliation compares.</strong> Section 5 (HERD vs bottom-up
              streams) is <em>not</em> the Vol 70/71 reconciliation. It compares institution-reported HERD federal
              R&amp;D against the sum of NIH RePORTER + NSF Awards + USASpending contracts + USASpending assistance,
              year by year. Gaps reflect timing (expenditures vs obligations), sub-agency allocation methodology, and
              PIID resolution — see the Three data landmines section above.
            </p>
            <p>
              <strong className="text-text-primary">NSF co-PI recovery status (S1.5).</strong>{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nsf_award</code> stores only the lead PI
              per row (266K rows for 266K awards; all rows have{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                pi_role = &apos;Principal Investigator&apos;
              </code>
              ); an aggregate <code className="text-xs bg-accent-muted/40 rounded px-1">n_pi</code> column counts the
              full team but does not provide individual co-PI surrogate keys. NSF does not publish a co-PI bridge in the
              public API. Consequence:
              <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">agg_uni_pi_universe</code>
              undercounts NSF; team-size bucketing (
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_team_size</code>) uses
              <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">n_pi</code> and is correct.
            </p>
            <p>
              <strong className="text-text-primary">FY2005 + FY2016 entity-resolution breaks.</strong>{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution</code> consolidated some
              multi-campus institutions (notably Harvard) into a single surrogate key in FY2005 and split them back out
              in FY2006. A smaller break occurred at the FY2016 boundary. 81 institutions (16.7%) show &gt;100% YoY
              swings at FY05→06. Both{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_pi_universe</code> and{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_team_size</code> now carry a{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">data_quality</code> column (
              <code className="text-xs bg-accent-muted/40 rounded px-1">fy05_entity_resolution_break</code> /{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fy16_minor_break</code> /{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">clean</code>). Charts mask or label affected
              years.
            </p>
            <p>
              <strong className="text-text-primary">Topic regex precision (S1.5).</strong> Topic tagging uses
              RE2-compatible regex over title + abstract. Two patterns were tightened:
              <em>Neuroscience &amp; brain</em> no longer matches the bare word{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">neural</code> (which over-matched AI/ML
              &ldquo;neural networks&rdquo;); <em>Earth observation</em> no longer matches bare{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">geospatial</code> (over-matched GIS-tangential
              work). Cancer keeps the broader pattern (cancer / oncology / tumor / carcinoma / malignan / metasta) with
              an acknowledged precision-vs-recall trade-off in favor of recall.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" id="nih-ic">
        <h2 className="h-section">NIH Institute breakdown</h2>
        <p className="text-text-secondary">
          The HERD &ldquo;HHS&rdquo; agency bar collapses NIH plus every other Health &amp; Human Services component
          (CDC, AHRQ, HRSA, etc.) into one number. The NIH IC drill-down opens up only the NIH portion, split across the
          27 Institutes &amp; Centers that actually administer the grants.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">What it is.</strong> Two pre-aggregated tables —{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_nih_ic</code> (per university × FY × IC)
              and <code className="text-xs bg-accent-muted/40 rounded px-1">agg_national_nih_ic</code> (national × FY ×
              IC with <code className="text-xs bg-accent-muted/40 rounded px-1">pct_of_nih</code>).
            </p>
            <p>
              <strong className="text-text-primary">How it&apos;s computed.</strong> We aggregate{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project.total_cost_nominal</code> by{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">admin_ic_code</code> (the administering IC). The
              IC&apos;s full name is parsed from{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">ic_name</code> (&ldquo;&lt;NAME&gt;:&lt;project
              title&gt;&rdquo;) and the most-frequent string per IC is kept. The per-university SK uses{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution_crosswalk</code>
              to land on the HERD-side institution_sk.
            </p>
            <p>
              <strong className="text-text-primary">Known limitations.</strong> admin_ic represents the IC that{' '}
              <em>manages</em> the project — multi-IC awards can list co-funding ICs that aren&apos;t reflected here.
              Non-NIH HHS components (CDC, AHRQ, HRSA, FDA, IHS) are not in{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">fact_nih_project</code>; the IC drill-down is
              strictly NIH. Some legacy / special codes (e.g.,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">RR</code> for the now-defunct National Center
              for Research Resources) appear in older FYs.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" id="specialization">
        <h2 className="h-section">University specialization score</h2>
        <p className="text-text-secondary">
          A topic-level specialization score that asks:{' '}
          <em>given how big this university is overall, does it over-index on this research topic?</em>
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">What it is.</strong>{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">
                specialization_score = uni_topic_share / uni_total_share
              </code>
              , computed per university × FY × topic.
            </p>
            <p>
              <code className="text-xs bg-accent-muted/40 rounded px-1">uni_topic_share</code> = uni&apos;s topic
              dollars ÷ national topic dollars;{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">uni_total_share</code> = uni&apos;s HERD total
              R&amp;D ÷ national HERD total. Score &gt; 1 means over-indexed (this uni captures a larger slice of the
              topic than its overall size would predict); &lt; 1 means under-indexed. Plus a national rank within
              (topic, FY).
            </p>
            <p>
              <strong className="text-text-primary">How it&apos;s computed.</strong> Source is{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_topic</code> (30-topic regex-tagged NSF
              + NIH grant text) joined to{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_total_rd</code>. Restricted to
              universities with HERD total R&amp;D &gt; 0 in that FY (a federal-grants-only institution has no
              meaningful baseline for the share-of-share ratio).
            </p>
            <p>
              <strong className="text-text-primary">Known limitations.</strong> Topic dollars come from regex-tagged NSF
              + NIH grant text (titles + abstracts + project terms); they are a subset of total federal $ and don&apos;t
              include other agencies&apos; awards. Score is sensitive to the same caveats as the 30-topic taxonomy: a
              grant can match multiple topics (non-exclusive). The HERD-total denominator is institution-reported and
              subject to the FY2005/FY2016 quality flags.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" id="state-topic">
        <h2 className="h-section">State topic specialization</h2>
        <p className="text-text-secondary">
          The 30-topic taxonomy rolled up to U.S. state — which states&apos; universities captured the largest share of
          the national topic dollars in the latest FY.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">What it is.</strong> Per state × FY × topic, the total tagged
              federal $, the state&apos;s share of the national topic total, and the leading institution_sk within that
              state for that topic. Source:{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_state_topic</code>.
            </p>
            <p>
              <strong className="text-text-primary">How it&apos;s computed.</strong>{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_topic</code> joined to{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">dim_institution.state_code</code>, summed by
              state × FY × topic. The top-uni-in-state is a window function (ROW_NUMBER over topic-amount DESC inside
              each state).
            </p>
            <p>
              <strong className="text-text-primary">Known limitations.</strong> A university is counted in its
              headquarters state (the <code className="text-xs bg-accent-muted/40 rounded px-1">state_code</code> on
              dim_institution), even when research is performed at branch campuses elsewhere. Topic overlap means shares
              are not exclusive within state.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" id="growth">
        <h2 className="h-section">5/10/20-year growth (climbers &amp; fallers)</h2>
        <p className="text-text-secondary">
          Compound-annual-growth-rate (CAGR) for each HERD university over three windows ending at FY2024, plus
          year-on-year change and a 5-year rank movement.
        </p>
        <Card>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <p>
              <strong className="text-text-primary">What it is.</strong> One row per HERD university (with FY2024 total
              ≥ $5M) in <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_growth</code>. Columns:
              fy24/fy19/fy14/fy05 totals, <code className="text-xs bg-accent-muted/40 rounded px-1">cagr_5yr</code>,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">cagr_10yr</code>,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">cagr_20yr</code>,{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">yoy_change_pct</code>,
              <code className="text-xs bg-accent-muted/40 rounded px-1 mx-1">fy24_rank</code>,
              <code className="text-xs bg-accent-muted/40 rounded px-1">rank_change_5yr</code>.
            </p>
            <p>
              <strong className="text-text-primary">How it&apos;s computed.</strong>{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">cagr_5yr = (FY24 / FY19)^(1/5) − 1</code> (and
              analogously for 10 and 20 years). Ranks are over the same FY24 ≥ $5M cohort. Source is{' '}
              <code className="text-xs bg-accent-muted/40 rounded px-1">agg_uni_total_rd</code> (HERD-reported nominal
              R&amp;D).
            </p>
            <p>
              <strong className="text-text-primary">Known limitations.</strong> Nominal dollars; CPI deflation would
              trim the FY19→FY24 CAGR by roughly 2.5–3 percentage points per year given the post-pandemic inflation. The
              $5M floor avoids divide-by-tiny CAGRs (a uni going from $200K to $20M is technically 100× growth but not
              editorially interesting). Universities that fell below $5M in FY24 are dropped, which makes the
              &ldquo;fallers&rdquo; list a conservative one (true collapses out of the dataset are not surfaced).
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

function SourceCard({ source }: { source: (typeof SOURCES)[SourceId] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a className="hover:text-accent" href={source.homeUrl} target="_blank" rel="noopener noreferrer">
            {source.shortName}
          </a>
        </CardTitle>
        <div className="text-2xs uppercase tracking-wide text-text-tertiary">
          {source.publisherAcronym}
          {source.identifier && <span> · {source.identifier}</span>}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-text-secondary space-y-2">
        <p>{source.description}</p>
        <p className="text-[11px] text-text-tertiary">
          <a
            className="hover:text-accent underline-offset-2 hover:underline"
            href={source.rawDataUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Raw data archive →
          </a>
        </p>
      </CardContent>
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
