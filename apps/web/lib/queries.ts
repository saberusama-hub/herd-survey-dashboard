import { query, queryOne } from './duckdb';
import type { Row } from './types';

export interface HeadlineKpis extends Row {
  fy2024_federal: number;
  fy2024_bottom_up: number;
  n_universities: number;
  n_agencies: number;
  fy_min: number;
  fy_max: number;
}

/** Headline KPI row computed from sheet_04 + sheet_07 + sheet_01. */
export async function headlineKpis(): Promise<HeadlineKpis | null> {
  return queryOne<HeadlineKpis>(`
    SELECT
      (SELECT SUM(total_obligations_usd_nominal)
         FROM sheet_04_federal_rd_by_agency
         WHERE fiscal_year = 2024) AS fy2024_federal,
      (SELECT SUM(bottom_up_sum_usd_nominal)
         FROM sheet_07_cross_source_reconciliation
         WHERE fiscal_year = 2024) AS fy2024_bottom_up,
      (SELECT COUNT(DISTINCT institution_sk)
         FROM sheet_01_institution_funding_panel) AS n_universities,
      (SELECT COUNT(DISTINCT agency_sk)
         FROM sheet_04_federal_rd_by_agency) AS n_agencies,
      (SELECT MIN(fiscal_year) FROM sheet_04_federal_rd_by_agency) AS fy_min,
      (SELECT MAX(fiscal_year) FROM sheet_04_federal_rd_by_agency) AS fy_max
  `);
}

/**
 * Single scalar: cumulative federal R&D obligations FY2005-FY2024 from sheet_04.
 * Used as the Home hero stat ("$X.XT cumulative").
 */
export async function cumulativeFederalRd(): Promise<number | null> {
  const r = await queryOne<{ total: number }>(`
    SELECT SUM(total_obligations_usd_nominal) AS total
    FROM sheet_04_federal_rd_by_agency
    WHERE agency_parent IS NULL OR agency_parent = ''
  `);
  return r?.total ?? null;
}

/**
 * National bottom-up coverage over time: sum(bottom_up) / sum(HERD-federal)
 * per FY. Spec data-insight: "80% → 49% collapse" — this is the data behind it.
 */
export interface CoverageRow extends Row {
  fiscal_year: number;
  herd_federal_total: number;
  bottom_up_total: number;
  coverage_pct: number;
}

/**
 * Sheet 11: 3-line national bridge by FY (HERD vs FF-explicit vs FF-with-allocation).
 * Spec section 5.7 — central chart of /reconciliation.
 */
export interface BridgeRow extends Row {
  fiscal_year: number;
  ff_explicit_universities_obligations_usd: number | null;
  ff_universities_estimate_with_allocation_usd: number | null;
  herd_reported_universities_expenditures_usd: number | null;
  gap_ff_explicit_minus_herd_usd: number | null;
  gap_ff_estimate_minus_herd_usd: number | null;
}

export async function federalUniversityBridge(): Promise<BridgeRow[]> {
  return query<BridgeRow>(`
    SELECT
      fiscal_year,
      ff_explicit_universities_obligations_usd,
      ff_universities_estimate_with_allocation_usd,
      herd_reported_universities_expenditures_usd,
      gap_ff_explicit_minus_herd_usd,
      gap_ff_estimate_minus_herd_usd
    FROM sheet_11_federal_university_bridge
    ORDER BY fiscal_year
  `);
}

/**
 * Per-institution HERD vs BU gap for a single FY (used by the Reconciliation dumbbell).
 * Returns top-N by HERD federal R&D with both anchors populated.
 */
export interface ReconcileGap extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  fiscal_year: number;
  herd: number;
  bu: number;
  gap_usd: number;
  gap_pct: number;
}

export async function reconciliationGap(fy: number, topN = 50): Promise<ReconcileGap[]> {
  return query<ReconcileGap>(`
    SELECT
      institution_sk,
      canonical_name,
      state_code,
      fiscal_year,
      herd_federal_rd_usd_nominal AS herd,
      bottom_up_sum_usd_nominal AS bu,
      (bottom_up_sum_usd_nominal - herd_federal_rd_usd_nominal) AS gap_usd,
      CASE WHEN herd_federal_rd_usd_nominal > 0
           THEN ((bottom_up_sum_usd_nominal - herd_federal_rd_usd_nominal) / herd_federal_rd_usd_nominal)
           ELSE NULL END AS gap_pct
    FROM sheet_07_cross_source_reconciliation
    WHERE fiscal_year = ${fy}
      AND herd_federal_rd_usd_nominal IS NOT NULL
      AND bottom_up_sum_usd_nominal IS NOT NULL
      AND is_tiny_anchor = false
    ORDER BY herd_federal_rd_usd_nominal DESC
    LIMIT ${topN}
  `);
}

/**
 * Pair-row used for the FY20-vs-FY24 BU% connected scatter.
 * BU% = bottom_up_sum / herd_federal_rd.
 */
export interface BuCoveragePair extends Row {
  institution_sk: string;
  canonical_name: string;
  bu_pct_fy_a: number;
  bu_pct_fy_b: number;
  herd_fy_b: number;
}

export async function bottomUpCoveragePair(fyA: number, fyB: number): Promise<BuCoveragePair[]> {
  return query<BuCoveragePair>(`
    WITH coverage AS (
      SELECT
        institution_sk,
        canonical_name,
        fiscal_year,
        herd_federal_rd_usd_nominal AS herd,
        bottom_up_sum_usd_nominal AS bu
      FROM sheet_07_cross_source_reconciliation
      WHERE fiscal_year IN (${fyA}, ${fyB})
        AND herd_federal_rd_usd_nominal > 0
        AND bottom_up_sum_usd_nominal IS NOT NULL
        AND is_tiny_anchor = false
    ),
    pivot AS (
      SELECT
        institution_sk,
        ANY_VALUE(canonical_name) AS canonical_name,
        MAX(CASE WHEN fiscal_year = ${fyA} THEN bu/herd END) AS bu_pct_fy_a,
        MAX(CASE WHEN fiscal_year = ${fyB} THEN bu/herd END) AS bu_pct_fy_b,
        MAX(CASE WHEN fiscal_year = ${fyB} THEN herd END) AS herd_fy_b
      FROM coverage
      GROUP BY institution_sk
    )
    SELECT *
    FROM pivot
    WHERE bu_pct_fy_a IS NOT NULL
      AND bu_pct_fy_b IS NOT NULL
      AND herd_fy_b > 50000000
    ORDER BY herd_fy_b DESC
  `);
}

export async function bottomUpCoverageByFy(): Promise<CoverageRow[]> {
  return query<CoverageRow>(`
    SELECT
      fiscal_year,
      SUM(herd_federal_rd_usd_nominal) AS herd_federal_total,
      SUM(bottom_up_sum_usd_nominal) AS bottom_up_total,
      CASE WHEN SUM(herd_federal_rd_usd_nominal) > 0
           THEN SUM(bottom_up_sum_usd_nominal) / SUM(herd_federal_rd_usd_nominal)
           ELSE NULL END AS coverage_pct
    FROM sheet_07_cross_source_reconciliation
    WHERE herd_federal_rd_usd_nominal IS NOT NULL
    GROUP BY fiscal_year
    ORDER BY fiscal_year
  `);
}

export interface TopRecipient extends Row {
  institution_sk: string;
  canonical_name: string;
  herd_federal_rd_usd_nominal: number;
}

/**
 * Per-institution per-FY HERD federal series (long format).
 * Used to render the sparkline column in the Home leaderboard.
 */
export interface InstFySpark extends Row {
  institution_sk: string;
  fiscal_year: number;
  value: number | null;
}

export async function sparklinesForCohort(
  institutionSks: string[],
  fyMin: number,
  fyMax: number,
): Promise<InstFySpark[]> {
  if (institutionSks.length === 0) return [];
  const sksList = institutionSks.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
  return query<InstFySpark>(`
    SELECT
      institution_sk,
      fiscal_year,
      herd_federal_rd_usd_nominal AS value
    FROM sheet_07_cross_source_reconciliation
    WHERE institution_sk IN (${sksList})
      AND fiscal_year BETWEEN ${fyMin} AND ${fyMax}
    ORDER BY institution_sk, fiscal_year
  `);
}

/** Top-N HERD-anchored universities by FY federal R&D (from Sheet 7). */
export async function topRecipientsByFy(fy: number, n = 15): Promise<TopRecipient[]> {
  return query<TopRecipient>(`
    SELECT
      institution_sk,
      canonical_name,
      herd_federal_rd_usd_nominal
    FROM sheet_07_cross_source_reconciliation
    WHERE fiscal_year = ${fy}
      AND herd_federal_rd_usd_nominal IS NOT NULL
    ORDER BY herd_federal_rd_usd_nominal DESC
    LIMIT ${n}
  `);
}

export interface AgencyMixRow extends Row {
  agency_name: string;
  total: number;
}

/** FY federal agency mix (top 10), used by the Home hero. */
export async function fyAgencyMix(fy: number): Promise<AgencyMixRow[]> {
  return query<AgencyMixRow>(`
    SELECT
      COALESCE(agency_name, 'Other') AS agency_name,
      SUM(total_obligations_usd_nominal) AS total
    FROM sheet_04_federal_rd_by_agency
    WHERE fiscal_year = ${fy}
      AND (agency_parent IS NULL OR agency_parent = '')
    GROUP BY agency_name
    ORDER BY total DESC NULLS LAST
    LIMIT 10
  `);
}

/** Metric registry — what users can choose to chart on Trends. */
export type MetricKey =
  | 'herd_federal'
  | 'nih_total'
  | 'nsf_obligation'
  | 'usas_contracts'
  | 'usas_assistance'
  | 'bottom_up_total';

export interface MetricDef {
  key: MetricKey;
  label: string;
  description: string;
  column: string;
  sourceTable: string;
}

export const METRICS: MetricDef[] = [
  {
    key: 'herd_federal',
    label: 'HERD federal R&D',
    description: 'Top-down: federal share of HERD-reported R&D expenditures.',
    column: 'herd_federal_rd_usd_nominal',
    sourceTable: 'sheet_07_cross_source_reconciliation',
  },
  {
    key: 'nih_total',
    label: 'NIH total cost',
    description: 'NIH ExPORTER award totals attributed to institution.',
    column: 'nih_total_cost_usd_nominal',
    sourceTable: 'sheet_07_cross_source_reconciliation',
  },
  {
    key: 'nsf_obligation',
    label: 'NSF obligations',
    description: 'NSF Awards FY obligations attributed to institution.',
    column: 'nsf_fy_obligation_usd_nominal',
    sourceTable: 'sheet_07_cross_source_reconciliation',
  },
  {
    key: 'usas_contracts',
    label: 'USAS contracts',
    description: 'USAspending federal contract obligations to institution.',
    column: 'usaspending_contracts_usd_nominal',
    sourceTable: 'sheet_07_cross_source_reconciliation',
  },
  {
    key: 'usas_assistance',
    label: 'USAS assistance',
    description: 'USAspending federal grants/assistance to institution.',
    column: 'usaspending_assistance_usd_nominal',
    sourceTable: 'sheet_07_cross_source_reconciliation',
  },
  {
    key: 'bottom_up_total',
    label: 'Bottom-up total',
    description: 'NIH + NSF + USAS contracts + USAS assistance, summed.',
    column: 'bottom_up_sum_usd_nominal',
    sourceTable: 'sheet_07_cross_source_reconciliation',
  },
];

export function getMetric(key: MetricKey): MetricDef {
  const m = METRICS.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown metric: ${key}`);
  return m;
}

export interface InstitutionFy extends Row {
  institution_sk: string;
  canonical_name: string;
  fiscal_year: number;
  value: number | null;
}

/** Pull a metric's time series for a list of institutions. */
export async function metricTimeseries(
  metric: MetricKey,
  institutionSks: string[],
  fyMin: number,
  fyMax: number,
): Promise<InstitutionFy[]> {
  if (institutionSks.length === 0) return [];
  const m = getMetric(metric);
  const sksList = institutionSks.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
  return query<InstitutionFy>(`
    SELECT
      institution_sk,
      canonical_name,
      fiscal_year,
      ${m.column} AS value
    FROM ${m.sourceTable}
    WHERE fiscal_year BETWEEN ${fyMin} AND ${fyMax}
      AND institution_sk IN (${sksList})
    ORDER BY institution_sk, fiscal_year
  `);
}

/** Top-N institutions by total HERD federal R&D over the FY range. */
export async function topInstitutionsByHerdFederal(n: number, fyMin: number, fyMax: number): Promise<TopRecipient[]> {
  return query<TopRecipient>(`
    SELECT
      institution_sk,
      ANY_VALUE(canonical_name) AS canonical_name,
      SUM(herd_federal_rd_usd_nominal) AS herd_federal_rd_usd_nominal
    FROM sheet_07_cross_source_reconciliation
    WHERE fiscal_year BETWEEN ${fyMin} AND ${fyMax}
      AND herd_federal_rd_usd_nominal IS NOT NULL
    GROUP BY institution_sk
    ORDER BY herd_federal_rd_usd_nominal DESC NULLS LAST
    LIMIT ${n}
  `);
}

/**
 * Sheet 10 — federal R&D flow rows for a single FY, used to build the /flow Sankey.
 * Sheet structure is hierarchical: level=0 is the Federal total, 1 is agency, 2 is performer.
 * Each row knows its parent_node_id so we can build nodes + links directly.
 */
export interface FlowRow extends Row {
  fiscal_year: number;
  level: number;
  node_id: string;
  parent_node_id: string | null;
  agency_sk: string | null;
  agency_name: string | null;
  performer_category: string | null;
  amount_usd_nominal: number;
  amount_usd_real_2024: number;
}

export async function federalRdFlow(fy: number): Promise<FlowRow[]> {
  return query<FlowRow>(`
    SELECT
      fiscal_year, level, node_id, parent_node_id,
      agency_sk, agency_name, performer_category,
      amount_usd_nominal, amount_usd_real_2024
    FROM sheet_10_federal_rd_flow
    WHERE fiscal_year = ${fy}
      AND amount_usd_nominal IS NOT NULL
      AND amount_usd_nominal > 0
  `);
}

export interface StateRollup extends Row {
  state_code: string;
  total: number;
  n_institutions: number;
}

/** State-level totals for the State Map. */
export async function stateRollup(metric: MetricKey, fy: number): Promise<StateRollup[]> {
  const m = getMetric(metric);
  return query<StateRollup>(`
    SELECT
      state_code,
      SUM(${m.column}) AS total,
      COUNT(DISTINCT institution_sk) AS n_institutions
    FROM ${m.sourceTable}
    WHERE fiscal_year = ${fy}
      AND state_code IS NOT NULL
      AND ${m.column} IS NOT NULL
    GROUP BY state_code
    ORDER BY total DESC NULLS LAST
  `);
}

export interface InstitutionTotal extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  total: number;
}

/** Top institutions in a given state for the State Map drilldown. */
export async function topInstitutionsInState(
  state: string,
  metric: MetricKey,
  fy: number,
  n = 20,
): Promise<InstitutionTotal[]> {
  const m = getMetric(metric);
  return query<InstitutionTotal>(`
    SELECT
      institution_sk,
      canonical_name,
      state_code,
      ${m.column} AS total
    FROM ${m.sourceTable}
    WHERE fiscal_year = ${fy}
      AND state_code = '${state.replace(/'/g, "''")}'
      AND ${m.column} IS NOT NULL
    ORDER BY total DESC NULLS LAST
    LIMIT ${n}
  `);
}

/** All HERD-tracked institutions (for the typeahead). */
export interface InstitutionListItem extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  sector: string | null;
  total_herd_federal_rd_usd_nominal: number | null;
}

export async function allInstitutions(): Promise<InstitutionListItem[]> {
  return query<InstitutionListItem>(`
    SELECT
      institution_sk,
      ANY_VALUE(canonical_name) AS canonical_name,
      ANY_VALUE(state_code) AS state_code,
      ANY_VALUE(sector) AS sector,
      SUM(herd_federal_rd_usd_nominal) AS total_herd_federal_rd_usd_nominal
    FROM sheet_07_cross_source_reconciliation
    GROUP BY institution_sk
    ORDER BY total_herd_federal_rd_usd_nominal DESC NULLS LAST
  `);
}

/** Full time series for one institution across all reconciliation metrics. */
export interface InstitutionRow extends Row {
  fiscal_year: number;
  herd_federal_rd_usd_nominal: number | null;
  nih_total_cost_usd_nominal: number | null;
  nsf_fy_obligation_usd_nominal: number | null;
  usaspending_assistance_usd_nominal: number | null;
  usaspending_contracts_usd_nominal: number | null;
  bottom_up_sum_usd_nominal: number | null;
  delta_usd: number | null;
  delta_pct: number | null;
  is_tiny_anchor: boolean | null;
}

export async function institutionTimeseries(sk: string): Promise<InstitutionRow[]> {
  return query<InstitutionRow>(`
    SELECT
      fiscal_year,
      herd_federal_rd_usd_nominal,
      nih_total_cost_usd_nominal,
      nsf_fy_obligation_usd_nominal,
      usaspending_assistance_usd_nominal,
      usaspending_contracts_usd_nominal,
      bottom_up_sum_usd_nominal,
      delta_usd,
      delta_pct,
      is_tiny_anchor
    FROM sheet_07_cross_source_reconciliation
    WHERE institution_sk = '${sk.replace(/'/g, "''")}'
    ORDER BY fiscal_year
  `);
}

export interface InstitutionMeta extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  sector: string | null;
}

export async function institutionMeta(sk: string): Promise<InstitutionMeta | null> {
  return queryOne<InstitutionMeta>(`
    SELECT
      institution_sk,
      ANY_VALUE(canonical_name) AS canonical_name,
      ANY_VALUE(state_code) AS state_code,
      ANY_VALUE(sector) AS sector
    FROM sheet_07_cross_source_reconciliation
    WHERE institution_sk = '${sk.replace(/'/g, "''")}'
    GROUP BY institution_sk
  `);
}

/** Per-institution per-FY agency mix (from sheet_02_institution_agency). */
export interface InstAgencyRow extends Row {
  fiscal_year: number;
  NSF: number | null;
  DOD: number | null;
  DOE: number | null;
  NASA: number | null;
  USDA: number | null;
  ED: number | null;
  EPA: number | null;
  HHS: number | null;
  DOC: number | null;
  Other: number | null;
}

export async function institutionAgencyMix(sk: string): Promise<InstAgencyRow[]> {
  return query<InstAgencyRow>(`
    SELECT
      fiscal_year,
      NSF, DOD, DOE, NASA, USDA, ED, EPA, HHS, DOC, "Other"
    FROM sheet_02_institution_agency
    WHERE institution_sk = '${sk.replace(/'/g, "''")}'
    ORDER BY fiscal_year
  `);
}

/** Per-institution NIH IC breakdown (FY2024 latest, from sheet_12). */
export interface InstNihIcRow extends Row {
  fiscal_year: number;
  nih_total_usd_nominal: number | null;
  n_distinct_projects: number | null;
  nih_NCI_usd_nominal: number | null;
  nih_NIAID_usd_nominal: number | null;
  nih_NHLBI_usd_nominal: number | null;
  nih_NIGMS_usd_nominal: number | null;
  nih_NIA_usd_nominal: number | null;
  nih_NIDDK_usd_nominal: number | null;
  nih_NINDS_usd_nominal: number | null;
  nih_NIMH_usd_nominal: number | null;
}

export async function institutionNihIcLatest(sk: string): Promise<InstNihIcRow | null> {
  return queryOne<InstNihIcRow>(`
    SELECT
      fiscal_year,
      nih_total_usd_nominal,
      n_distinct_projects,
      nih_NCI_usd_nominal,
      nih_NIAID_usd_nominal,
      nih_NHLBI_usd_nominal,
      nih_NIGMS_usd_nominal,
      nih_NIA_usd_nominal,
      nih_NIDDK_usd_nominal,
      nih_NINDS_usd_nominal,
      nih_NIMH_usd_nominal
    FROM sheet_12_nih_ic_breakdown
    WHERE institution_sk = '${sk.replace(/'/g, "''")}'
    ORDER BY fiscal_year DESC
    LIMIT 1
  `);
}

// ─────────── Phase P1.18: aggregation-backed helpers ────────────────────────
//
// `institution_sk` is a STRING ('INST0000001') in the dim_institution real
// schema — NOT a number. All new helpers below honor that. The 15 agg_*
// parquets registered in `lib/duckdb.ts` back these queries.

const sq = (s: string) => s.replace(/'/g, "''");

export interface UniversityProfile extends Row {
  institution_sk: string;
  name: string;
  state: string;
  totalRd: Array<{ fiscal_year: number; total_rd_nominal: number; total_rd_real: number }>;
  sources: Array<{ fiscal_year: number; source_category: string; amount_nominal: number }>;
  agencies: Array<{ fiscal_year: number; agency_bucket: string; amount_nominal: number }>;
  federalFunds: Array<{ fiscal_year: number; agency_bucket: string; amount_nominal: number; taxonomy_version: string }>;
  piMetrics: Array<{
    fiscal_year: number;
    distinct_pi_count: number;
    federal_amount_nsf: number;
    federal_amount_nih: number;
    federal_amount_total: number;
    amount_per_pi: number;
  }>;
  piDistribution: Array<{
    fiscal_year: number;
    decile: number;
    min_amount: number;
    max_amount: number;
    avg_amount: number;
    pi_count: number;
  }>;
  teamSize: Array<{
    fiscal_year: number;
    team_size_bucket: string;
    grant_count: number;
    total_amount: number;
  }>;
  topics: Array<{
    fiscal_year: number;
    topic: string;
    grant_count: number;
    tagged_amount: number;
  }>;
  fieldMix: Array<{ fiscal_year: number; field_category: string; is_stem: boolean; amount_nominal: number }>;
  subjectTags: Array<{ fiscal_year: number; subject_tag: string; tagged_amount: number }>;
  concentration: Array<{ fiscal_year: number; hhi: number; shannon_entropy: number; cov_5yr: number | null }>;
  stateContext: Array<{ fiscal_year: number; uni_total: number; state_total: number; share_of_state: number }>;
  peers: Array<{ peer_sk: string; peer_rank: number }>;
  patents: Array<{
    fiscal_year: number;
    award_count: number;
    patent_count: number | null;
    patents_per_award: number | null;
  }>;
}

export async function getUniversityProfile(sk: string): Promise<UniversityProfile> {
  const safe = sq(sk);
  const [
    name,
    totalRd,
    sources,
    agencies,
    federalFunds,
    piMetrics,
    piDistribution,
    teamSize,
    topics,
    fieldMix,
    subjectTags,
    concentration,
    stateContext,
    peers,
    patents,
  ] = await Promise.all([
    query<{ canonical_name: string; state_code: string }>(
      `SELECT canonical_name, state_code FROM dim_institution WHERE institution_sk = '${safe}'`,
    ),
    query<UniversityProfile['totalRd'][number]>(
      `SELECT fiscal_year, total_rd_nominal, total_rd_real FROM agg_uni_total_rd WHERE institution_sk = '${safe}' ORDER BY fiscal_year`,
    ),
    query<UniversityProfile['sources'][number]>(
      `SELECT fiscal_year, source_category, amount_nominal FROM agg_uni_source_split WHERE institution_sk = '${safe}' ORDER BY fiscal_year, source_category`,
    ),
    query<UniversityProfile['agencies'][number]>(
      `SELECT fiscal_year, agency_bucket, amount_nominal FROM agg_uni_agency_split WHERE institution_sk = '${safe}' ORDER BY fiscal_year, agency_bucket`,
    ),
    query<UniversityProfile['federalFunds'][number]>(
      `SELECT fiscal_year, agency_bucket, amount_nominal, taxonomy_version FROM agg_uni_federal_funds WHERE institution_sk = '${safe}' ORDER BY fiscal_year, agency_bucket`,
    ),
    // Phase R: full federal-PI universe (was: top-1K-grants floor).
    query<UniversityProfile['piMetrics'][number]>(
      `SELECT fiscal_year, distinct_pi_count, federal_amount_nsf, federal_amount_nih,
              federal_amount_total, amount_per_pi
       FROM agg_uni_pi_universe WHERE institution_sk = '${safe}' ORDER BY fiscal_year`,
    ),
    query<UniversityProfile['piDistribution'][number]>(
      `SELECT fiscal_year, decile, min_amount, max_amount, avg_amount, pi_count FROM agg_uni_pi_distribution WHERE institution_sk = '${safe}' ORDER BY fiscal_year, decile`,
    ),
    query<UniversityProfile['teamSize'][number]>(
      `SELECT fiscal_year, team_size_bucket, grant_count, total_amount
       FROM agg_uni_team_size WHERE institution_sk = '${safe}'
       ORDER BY fiscal_year, team_size_bucket`,
    ),
    query<UniversityProfile['topics'][number]>(
      `SELECT fiscal_year, topic, grant_count, tagged_amount
       FROM agg_uni_topic WHERE institution_sk = '${safe}'
       ORDER BY fiscal_year, tagged_amount DESC`,
    ),
    query<UniversityProfile['fieldMix'][number]>(
      `SELECT fiscal_year, field_category, is_stem, amount_nominal FROM agg_uni_field_mix WHERE institution_sk = '${safe}' ORDER BY fiscal_year, field_category`,
    ),
    query<UniversityProfile['subjectTags'][number]>(
      `SELECT fiscal_year, subject_tag, tagged_amount FROM agg_uni_subject_tag WHERE institution_sk = '${safe}' ORDER BY fiscal_year, subject_tag`,
    ),
    query<UniversityProfile['concentration'][number]>(
      `SELECT fiscal_year, hhi, shannon_entropy, cov_5yr FROM agg_uni_concentration WHERE institution_sk = '${safe}' ORDER BY fiscal_year`,
    ),
    query<UniversityProfile['stateContext'][number]>(
      `SELECT fiscal_year, uni_total, state_total, share_of_state FROM agg_uni_state_context WHERE institution_sk = '${safe}' ORDER BY fiscal_year`,
    ),
    query<UniversityProfile['peers'][number]>(
      `SELECT peer_sk, peer_rank FROM agg_uni_peers WHERE uni_sk = '${safe}' ORDER BY peer_rank`,
    ),
    query<UniversityProfile['patents'][number]>(
      `SELECT fiscal_year, award_count, patent_count, patents_per_award FROM agg_uni_patents WHERE institution_sk = '${safe}' ORDER BY fiscal_year`,
    ),
  ]);

  if (name.length === 0) throw new Error(`Institution ${sk} not found`);

  return {
    institution_sk: sk,
    name: name[0].canonical_name,
    state: name[0].state_code,
    totalRd,
    sources,
    agencies,
    federalFunds,
    piMetrics,
    piDistribution,
    teamSize,
    topics,
    fieldMix,
    subjectTags,
    concentration,
    stateContext,
    peers,
    patents,
  };
}

// ─────────── Phase R: team-size + topics helpers (national + per-uni) ────────

export interface TeamSizeRow extends Row {
  fiscal_year: number;
  team_size_bucket: string;
  grant_count: number;
  total_amount: number;
}

export interface NationalTeamSizeRow extends TeamSizeRow {
  share_of_total: number;
}

export interface TopicRow extends Row {
  fiscal_year: number;
  topic: string;
  grant_count: number;
  tagged_amount: number;
}

export interface NationalTopicRow extends TopicRow {
  share_of_total: number;
}

export async function getUniversityTeamSize(sk: string): Promise<TeamSizeRow[]> {
  const safe = sq(sk);
  return query<TeamSizeRow>(`
    SELECT fiscal_year, team_size_bucket, grant_count, total_amount
    FROM agg_uni_team_size
    WHERE institution_sk = '${safe}'
    ORDER BY fiscal_year, team_size_bucket
  `);
}

export async function getUniversityTopics(sk: string): Promise<TopicRow[]> {
  const safe = sq(sk);
  return query<TopicRow>(`
    SELECT fiscal_year, topic, grant_count, tagged_amount
    FROM agg_uni_topic
    WHERE institution_sk = '${safe}'
    ORDER BY fiscal_year, tagged_amount DESC
  `);
}

export async function getNationalTeamSize(): Promise<NationalTeamSizeRow[]> {
  return query<NationalTeamSizeRow>(`
    SELECT fiscal_year, team_size_bucket, grant_count, total_amount, share_of_total
    FROM agg_national_team_size
    ORDER BY fiscal_year, team_size_bucket
  `);
}

export async function getNationalTopics(): Promise<NationalTopicRow[]> {
  return query<NationalTopicRow>(`
    SELECT fiscal_year, topic, grant_count, tagged_amount, share_of_total
    FROM agg_national_topic
    ORDER BY fiscal_year, tagged_amount DESC
  `);
}

// ─────────── National view ───────────
export async function getNationalOverview() {
  return query<{ fiscal_year: number; source_category: string; amount_nominal: number; amount_real: number }>(
    'SELECT * FROM agg_national_overview ORDER BY fiscal_year, source_category',
  );
}

export async function getNationalAgencyTrend() {
  return query<{ fiscal_year: number; agency_bucket: string; amount_nominal: number; amount_real: number }>(
    'SELECT * FROM agg_national_agency_trend ORDER BY fiscal_year, agency_bucket',
  );
}

export async function getNationalConcentration() {
  return query<{ fiscal_year: number; bucket: string; share: number }>(
    'SELECT * FROM agg_national_concentration ORDER BY fiscal_year, bucket',
  );
}

// ─────────── /national §4 Geography (P5.2) ───────────
//
// Aggregate `agg_uni_total_rd` × `dim_institution` to per-state nominal $.
// Returns one row per state for the given FY. Defaults to latest FY in the
// agg table if `fy` is null.

export interface NationalStateRollupRow extends Row {
  state_code: string;
  fiscal_year: number;
  total_rd_nominal: number;
  n_institutions: number;
}

export async function getNationalStateRollup(fy?: number): Promise<NationalStateRollupRow[]> {
  // Latest FY fallback: subquery picks MAX(fiscal_year) from agg_uni_total_rd.
  const fyClause = fy !== undefined && fy !== null ? `${fy}` : '(SELECT MAX(fiscal_year) FROM agg_uni_total_rd)';
  return query<NationalStateRollupRow>(`
    SELECT
      i.state_code,
      t.fiscal_year,
      SUM(t.total_rd_nominal) AS total_rd_nominal,
      COUNT(DISTINCT t.institution_sk) AS n_institutions
    FROM agg_uni_total_rd t
    JOIN dim_institution i USING (institution_sk)
    WHERE t.fiscal_year = ${fyClause}
      AND t.total_rd_nominal IS NOT NULL
      AND i.state_code IS NOT NULL
    GROUP BY i.state_code, t.fiscal_year
    ORDER BY total_rd_nominal DESC
  `);
}

// ─────────── /national §6 Disciplines (P5.2) ───────────
//
// National rollup of `agg_uni_field_mix`. One row per FY × field_category ×
// is_stem; sums amount_nominal across all institutions.

export interface NationalFieldMixRow extends Row {
  fiscal_year: number;
  field_category: string;
  is_stem: boolean;
  amount_nominal: number;
}

export async function getNationalFieldMix(): Promise<NationalFieldMixRow[]> {
  return query<NationalFieldMixRow>(`
    SELECT
      fiscal_year,
      field_category,
      is_stem,
      SUM(amount_nominal) AS amount_nominal
    FROM agg_uni_field_mix
    WHERE amount_nominal IS NOT NULL
    GROUP BY fiscal_year, field_category, is_stem
    ORDER BY fiscal_year, field_category
  `);
}

// ─────────── /national §7 PI distribution (P5.2) ───────────
//
// National decile distribution of $/PI. Averages per-decile averages across
// all institutions (decile-of-deciles); a coarse but defensible national
// view of how federal $ spreads across PIs.

export interface NationalPiDistributionRow extends Row {
  fiscal_year: number;
  decile: number;
  avg_amount: number;
  pi_count: number;
}

export async function getNationalPiDistribution(): Promise<NationalPiDistributionRow[]> {
  return query<NationalPiDistributionRow>(`
    SELECT
      fiscal_year,
      decile,
      AVG(avg_amount) AS avg_amount,
      SUM(pi_count) AS pi_count
    FROM agg_uni_pi_distribution
    WHERE avg_amount IS NOT NULL
    GROUP BY fiscal_year, decile
    ORDER BY fiscal_year, decile
  `);
}

// ─────────── /national §5 Trends (P5.2) — multi-metric explorer ───────────
//
// National rollups of total_rd, federal_share, and pi_count by FY.

export interface NationalTrendRow extends Row {
  fiscal_year: number;
  total_rd_nominal: number;
  federal_share: number;
  pi_count: number;
}

export async function getNationalTrends(): Promise<NationalTrendRow[]> {
  return query<NationalTrendRow>(`
    WITH totals AS (
      SELECT fiscal_year, SUM(total_rd_nominal) AS total_rd_nominal
      FROM agg_uni_total_rd
      WHERE total_rd_nominal IS NOT NULL
      GROUP BY fiscal_year
    ),
    sources AS (
      SELECT
        fiscal_year,
        SUM(CASE WHEN source_category = 'federal' THEN amount_nominal ELSE 0 END)
          / NULLIF(SUM(amount_nominal), 0) AS federal_share
      FROM agg_uni_source_split
      WHERE amount_nominal IS NOT NULL
      GROUP BY fiscal_year
    ),
    pis AS (
      SELECT fiscal_year, SUM(distinct_pi_count) AS pi_count
      FROM agg_uni_pi_universe
      WHERE distinct_pi_count IS NOT NULL
      GROUP BY fiscal_year
    )
    SELECT
      t.fiscal_year,
      t.total_rd_nominal,
      s.federal_share,
      COALESCE(p.pi_count, 0) AS pi_count
    FROM totals t
    LEFT JOIN sources s USING (fiscal_year)
    LEFT JOIN pis p USING (fiscal_year)
    ORDER BY t.fiscal_year
  `);
}

// ─────────── /universities index table ───────────
export interface UniversityIndexRow extends Row {
  institution_sk: string;
  name: string;
  state: string;
  total_rd_fy2024: number;
  cagr_20yr: number | null;
  federal_share: number | null;
  pi_count: number;
  stem_share: number | null;
}

export async function getUniversityIndex(): Promise<UniversityIndexRow[]> {
  return query<UniversityIndexRow>(`
    WITH latest AS (
      SELECT institution_sk, total_rd_nominal AS total_rd_fy2024
      FROM agg_uni_total_rd
      WHERE fiscal_year = 2024
    ),
    cagr AS (
      SELECT institution_sk,
        POWER(
          MAX(CASE WHEN fiscal_year = 2024 THEN total_rd_nominal END)
            / NULLIF(MAX(CASE WHEN fiscal_year = 2005 THEN total_rd_nominal END), 0),
          1.0 / 19.0
        ) - 1 AS cagr_20yr
      FROM agg_uni_total_rd
      GROUP BY institution_sk
    ),
    fed AS (
      SELECT institution_sk,
        SUM(CASE WHEN source_category = 'federal' THEN amount_nominal ELSE 0 END)
          / NULLIF(SUM(amount_nominal), 0) AS federal_share
      FROM agg_uni_source_split
      WHERE fiscal_year = 2024
      GROUP BY institution_sk
    ),
    pi AS (
      SELECT institution_sk, distinct_pi_count AS pi_count
      FROM agg_uni_pi_universe
      WHERE fiscal_year = 2024
    ),
    stem AS (
      SELECT institution_sk,
        SUM(CASE WHEN is_stem THEN amount_nominal ELSE 0 END)
          / NULLIF(SUM(amount_nominal), 0) AS stem_share
      FROM agg_uni_field_mix
      WHERE fiscal_year = 2024
      GROUP BY institution_sk
    )
    SELECT
      l.institution_sk,
      i.canonical_name AS name,
      i.state_code AS state,
      l.total_rd_fy2024,
      c.cagr_20yr,
      f.federal_share,
      COALESCE(pi.pi_count, 0) AS pi_count,
      s.stem_share
    FROM latest l
    JOIN dim_institution i USING (institution_sk)
    LEFT JOIN cagr c USING (institution_sk)
    LEFT JOIN fed f USING (institution_sk)
    LEFT JOIN pi USING (institution_sk)
    LEFT JOIN stem s USING (institution_sk)
    ORDER BY l.total_rd_fy2024 DESC
  `);
}

/**
 * Search institutions, restricted to the ~1,014 HERD-tracked universities that
 * have rows in agg_uni_total_rd. This dedupes the raw 75,204-row dim_institution
 * (which contains every NSF/NIH grantee org incl. subunits, hospitals, school
 * districts, foreign collaborators) down to the HERD-survey universe so the
 * compare picker doesn't return ten different "Harvard" variants.
 *
 * Trade-off: institutions in NSF/NIH but NOT in HERD are unreachable here. For
 * full-universe search use searchAllInstitutions() (currently only used by the
 * old /universities/[sk] direct-link path; in practice that path is also
 * driven by HERD-tracked SKs).
 */
export async function searchInstitutions(
  q: string,
): Promise<Array<{ sk: string; name: string; state: string | null }>> {
  const safe = sq(q);
  return query<{ sk: string; name: string; state: string | null }>(`
    SELECT i.institution_sk AS sk, i.canonical_name AS name, i.state_code AS state
    FROM dim_institution i
    WHERE LOWER(i.canonical_name) LIKE LOWER('%${safe}%')
      AND i.institution_sk IN (SELECT DISTINCT institution_sk FROM agg_uni_total_rd)
    ORDER BY i.canonical_name
    LIMIT 20
  `);
}

/**
 * National rank (1 = largest) for a given institution × fiscal year, based on
 * total_rd_nominal from agg_uni_total_rd. Returns null if the institution did
 * not report in that fiscal year. The denominator (total ranked universities)
 * is returned alongside so the UI can render "47 of 812".
 */
export interface UniversityRank extends Row {
  rank: number;
  total_ranked: number;
}

export async function getUniversityRank(sk: string, fy: number): Promise<UniversityRank | null> {
  const safe = sq(sk);
  return queryOne<UniversityRank>(`
    WITH ranked AS (
      SELECT
        institution_sk,
        ROW_NUMBER() OVER (ORDER BY total_rd_nominal DESC NULLS LAST) AS rank,
        COUNT(*) OVER () AS total_ranked
      FROM agg_uni_total_rd
      WHERE fiscal_year = ${fy}
        AND total_rd_nominal IS NOT NULL
    )
    SELECT rank, total_ranked
    FROM ranked
    WHERE institution_sk = '${safe}'
  `);
}

/**
 * Resolve institution SKs to display names + state codes. Used by the profile
 * §9 peer panel to label peer rows. Empty input returns an empty array
 * (skips the round-trip).
 */
export interface InstitutionName extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
}

export async function getInstitutionNames(sks: string[]): Promise<InstitutionName[]> {
  if (sks.length === 0) return [];
  const list = sks.map((s) => `'${sq(s)}'`).join(',');
  return query<InstitutionName>(`
    SELECT institution_sk, canonical_name, state_code
    FROM dim_institution
    WHERE institution_sk IN (${list})
  `);
}

/**
 * Peer summary cards for the profile §9 view: peer name + state + latest
 * reported total R&D, ordered by peer_rank (1 = closest match).
 */
export interface PeerCard extends Row {
  peer_sk: string;
  peer_rank: number;
  canonical_name: string;
  state_code: string | null;
  fiscal_year: number | null;
  total_rd_nominal: number | null;
}

export async function getPeerCards(uniSk: string): Promise<PeerCard[]> {
  const safe = sq(uniSk);
  return query<PeerCard>(`
    WITH peers AS (
      SELECT peer_sk, peer_rank
      FROM agg_uni_peers
      WHERE uni_sk = '${safe}'
    ),
    latest AS (
      SELECT institution_sk, MAX(fiscal_year) AS fy
      FROM agg_uni_total_rd
      WHERE institution_sk IN (SELECT peer_sk FROM peers)
      GROUP BY institution_sk
    ),
    totals AS (
      SELECT t.institution_sk, t.fiscal_year, t.total_rd_nominal
      FROM agg_uni_total_rd t
      JOIN latest l
        ON l.institution_sk = t.institution_sk
       AND l.fy = t.fiscal_year
    )
    SELECT
      p.peer_sk,
      p.peer_rank,
      i.canonical_name,
      i.state_code,
      t.fiscal_year,
      t.total_rd_nominal
    FROM peers p
    JOIN dim_institution i ON i.institution_sk = p.peer_sk
    LEFT JOIN totals t ON t.institution_sk = p.peer_sk
    ORDER BY p.peer_rank
  `);
}

// ─────────── Phase S5: NIH IC, specialization, state topic, growth ───────────

export interface NihIcRow extends Row {
  fiscal_year: number;
  ic_code: string;
  ic_full_name: string;
  amount_nominal: number;
  project_count: number;
}

export interface NationalNihIcRow extends NihIcRow {
  pct_of_nih: number;
}

/** Per-uni NIH Institute breakdown (all FYs, all ICs with non-zero). */
export async function getUniversityNihICs(sk: string): Promise<NihIcRow[]> {
  const safe = sq(sk);
  return query<NihIcRow>(`
    SELECT fiscal_year, ic_code, ic_full_name, amount_nominal, project_count
    FROM agg_uni_nih_ic
    WHERE institution_sk = '${safe}'
    ORDER BY fiscal_year, amount_nominal DESC
  `);
}

/** National NIH IC roll-up (all FYs, all ICs). */
export async function getNationalNihICs(): Promise<NationalNihIcRow[]> {
  return query<NationalNihIcRow>(`
    SELECT fiscal_year, ic_code, ic_full_name, amount_nominal, project_count, pct_of_nih
    FROM agg_national_nih_ic
    ORDER BY fiscal_year, amount_nominal DESC
  `);
}

export interface SpecializationRow extends Row {
  fiscal_year: number;
  topic: string;
  uni_topic_amount: number;
  uni_topic_share: number;
  national_topic_amount: number;
  uni_total_amount: number;
  uni_total_share: number;
  specialization_score: number;
  topic_rank_national: number;
}

/** Latest-FY specialization snapshot for one university, top-N by score. */
export async function getUniversitySpecialization(
  sk: string,
  topN = 5,
): Promise<SpecializationRow[]> {
  const safe = sq(sk);
  return query<SpecializationRow>(`
    WITH latest AS (
      SELECT MAX(fiscal_year) AS fy
      FROM agg_uni_specialization
      WHERE institution_sk = '${safe}'
    )
    SELECT
      s.fiscal_year,
      s.topic,
      s.uni_topic_amount,
      s.uni_topic_share,
      s.national_topic_amount,
      s.uni_total_amount,
      s.uni_total_share,
      s.specialization_score,
      s.topic_rank_national
    FROM agg_uni_specialization s, latest
    WHERE s.institution_sk = '${safe}'
      AND s.fiscal_year = latest.fy
    ORDER BY s.specialization_score DESC NULLS LAST
    LIMIT ${topN}
  `);
}

export interface TopicLeaderRow extends Row {
  topic: string;
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  uni_topic_amount: number;
  specialization_score: number;
  topic_rank_national: number;
}

/** For each topic, top-N universities by uni_topic_amount in the latest FY. */
export async function getNationalTopicLeaders(topN = 5): Promise<TopicLeaderRow[]> {
  return query<TopicLeaderRow>(`
    WITH latest AS (
      SELECT MAX(fiscal_year) AS fy FROM agg_uni_specialization
    )
    SELECT
      s.topic,
      s.institution_sk,
      di.canonical_name,
      di.state_code,
      s.uni_topic_amount,
      s.specialization_score,
      s.topic_rank_national
    FROM agg_uni_specialization s, latest
    LEFT JOIN dim_institution di ON di.institution_sk = s.institution_sk
    WHERE s.fiscal_year = latest.fy
      AND s.topic_rank_national <= ${topN}
    ORDER BY s.topic, s.topic_rank_national
  `);
}

export interface StateTopicRow extends Row {
  state_code: string;
  fiscal_year: number;
  topic: string;
  state_topic_amount: number;
  state_topic_share: number;
  top_uni_in_state: string | null;
}

/** For each topic, top-N states by state_topic_amount in the latest FY. */
export async function getStateTopicLeaders(topN = 10): Promise<StateTopicRow[]> {
  return query<StateTopicRow>(`
    WITH latest AS (
      SELECT MAX(fiscal_year) AS fy FROM agg_state_topic
    ),
    ranked AS (
      SELECT
        s.state_code,
        s.fiscal_year,
        s.topic,
        s.state_topic_amount,
        s.state_topic_share,
        s.top_uni_in_state,
        ROW_NUMBER() OVER (
          PARTITION BY s.topic ORDER BY s.state_topic_amount DESC
        ) AS rn
      FROM agg_state_topic s, latest
      WHERE s.fiscal_year = latest.fy
    )
    SELECT state_code, fiscal_year, topic, state_topic_amount,
           state_topic_share, top_uni_in_state
    FROM ranked
    WHERE rn <= ${topN}
    ORDER BY topic, state_topic_amount DESC
  `);
}

export interface GrowthRow extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  fy24_total: number;
  fy19_total: number | null;
  fy14_total: number | null;
  fy05_total: number | null;
  cagr_5yr: number | null;
  cagr_10yr: number | null;
  cagr_20yr: number | null;
  yoy_change_pct: number | null;
  fy24_rank: number;
  fy19_rank: number | null;
  rank_change_5yr: number | null;
}

type GrowthWindow = '5yr' | '10yr' | '20yr';

function growthColumn(window: GrowthWindow): string {
  if (window === '10yr') return 'cagr_10yr';
  if (window === '20yr') return 'cagr_20yr';
  return 'cagr_5yr';
}

/** Top-N universities by CAGR over the chosen window. */
export async function getTopClimbers(
  window: GrowthWindow = '5yr',
  topN = 10,
): Promise<GrowthRow[]> {
  const col = growthColumn(window);
  return query<GrowthRow>(`
    SELECT
      g.institution_sk,
      di.canonical_name,
      di.state_code,
      g.fy24_total, g.fy19_total, g.fy14_total, g.fy05_total,
      g.cagr_5yr, g.cagr_10yr, g.cagr_20yr,
      g.yoy_change_pct, g.fy24_rank, g.fy19_rank, g.rank_change_5yr
    FROM agg_uni_growth g
    LEFT JOIN dim_institution di ON di.institution_sk = g.institution_sk
    WHERE g.${col} IS NOT NULL
    ORDER BY g.${col} DESC
    LIMIT ${topN}
  `);
}

/** Bottom-N universities by CAGR over the chosen window. */
export async function getTopFallers(
  window: GrowthWindow = '5yr',
  topN = 10,
): Promise<GrowthRow[]> {
  const col = growthColumn(window);
  return query<GrowthRow>(`
    SELECT
      g.institution_sk,
      di.canonical_name,
      di.state_code,
      g.fy24_total, g.fy19_total, g.fy14_total, g.fy05_total,
      g.cagr_5yr, g.cagr_10yr, g.cagr_20yr,
      g.yoy_change_pct, g.fy24_rank, g.fy19_rank, g.rank_change_5yr
    FROM agg_uni_growth g
    LEFT JOIN dim_institution di ON di.institution_sk = g.institution_sk
    WHERE g.${col} IS NOT NULL
    ORDER BY g.${col} ASC
    LIMIT ${topN}
  `);
}

/** Map institution_sk → cagr_5yr for the universities-table column. */
export async function getGrowthByInstitution(): Promise<
  Array<{ institution_sk: string; cagr_5yr: number | null }>
> {
  return query<{ institution_sk: string; cagr_5yr: number | null }>(`
    SELECT institution_sk, cagr_5yr
    FROM agg_uni_growth
  `);
}
