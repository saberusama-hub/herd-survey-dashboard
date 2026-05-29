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

export interface TopRecipient extends Row {
  institution_sk: string;
  canonical_name: string;
  herd_federal_rd_usd_nominal: number;
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
