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
