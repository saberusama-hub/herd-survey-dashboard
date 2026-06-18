/**
 * Parquet provenance map.
 *
 * For each parquet file the dashboard queries, this map records:
 *   - what the file contains
 *   - which upstream federal raw source(s) it was derived from
 *   - the specific subset of each upstream source used (table, column,
 *     filter, year range)
 *
 * Chart components use {@link getSources} to fetch citations by parquet name
 * when one isn't passed explicitly. This guarantees every visualization is
 * traceable to its raw federal archive — not the intermediate parquet, not
 * the master_workbook.xlsx, but the publisher's own data files.
 */

import type { SourceCitation } from './sources';

export interface ParquetProvenance {
  /** Parquet file name (no extension). */
  parquet: string;
  /** What this file contains, in plain English. */
  description: string;
  /** Upstream federal raw sources, in derivation order. */
  sources: SourceCitation[];
}

export const PARQUET_SOURCES: Record<string, ParquetProvenance> = {
  // ─────────────────────── National aggregations ───────────────────────
  agg_national_overview: {
    parquet: 'agg_national_overview',
    description:
      'National R&D by source category × fiscal year (federal, state, industry, institutional, nonprofit, other).',
    sources: [
      {
        id: 'ncses_herd',
        subset:
          'Q01 (Sources of Funds) summed across all HERD-tracked institutions per FY × source category, FY2005–FY2024.',
      },
    ],
  },
  agg_national_agency_trend: {
    parquet: 'agg_national_agency_trend',
    description: 'National federal R&D by funding agency × fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset:
          'Q09 (Federal R&D by Agency) summed across all HERD-tracked institutions per FY × agency bucket, FY2005–FY2024.',
      },
    ],
  },
  agg_national_concentration: {
    parquet: 'agg_national_concentration',
    description: 'Share of national R&D held by top-10, top-25, top-100 institutions per fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Total R&D) ranked per FY; cohort shares computed as top-N sum ÷ national total, FY2005–FY2024.',
      },
    ],
  },
  agg_national_nih_ic: {
    parquet: 'agg_national_nih_ic',
    description: 'National NIH funding broken out by administering Institute / Center × fiscal year.',
    sources: [
      {
        id: 'nih_exporter',
        subset:
          'fact_nih_project.total_cost_nominal grouped by admin_ic_code (27 NIH ICs + legacy codes), summed across all U.S. universities per FY, FY2005–FY2024.',
      },
    ],
  },
  agg_national_team_size: {
    parquet: 'agg_national_team_size',
    description: 'National federal R&D by PI team-size bucket (1, 2-5, 6-10, 11-20, 21+) × fiscal year.',
    sources: [
      {
        id: 'nsf_awards',
        subset: 'Lead PI + n_pi field per award; bucketed by team count.',
      },
      {
        id: 'nih_exporter',
        subset: 'PI bridge file: count(DISTINCT pi_id) per project_id, bucketed by team count.',
      },
    ],
  },
  agg_national_topic: {
    parquet: 'agg_national_topic',
    description: 'Federal R&D dollars tagged by 30-topic regex taxonomy × fiscal year (topic overlap allowed).',
    sources: [
      {
        id: 'nsf_awards',
        subset: 'awd_titl_txt + awd_abstr_narration text regex-matched against 30-topic taxonomy.',
      },
      {
        id: 'nih_exporter',
        subset: 'project_title + project_terms text regex-matched against 30-topic taxonomy.',
      },
    ],
  },
  agg_state_topic: {
    parquet: 'agg_state_topic',
    description: 'State-level rollup of the 30-topic regex taxonomy × fiscal year, with top university per state.',
    sources: [
      {
        id: 'nsf_awards',
        subset: 'Tagged grant $ joined to institution_sk → dim_institution.state_code.',
      },
      {
        id: 'nih_exporter',
        subset: 'Tagged grant $ joined to institution_sk → dim_institution.state_code.',
      },
      { id: 'ipeds', subset: 'HD directory file: STABBR (state abbreviation) for each UNITID.' },
    ],
  },

  // ─────────────────────── University-level aggregations ───────────────────────
  agg_uni_total_rd: {
    parquet: 'agg_uni_total_rd',
    description: 'Per-university total R&D (nominal + real) × fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Total R&D Expenditures) per institution × FY, FY2005–FY2024.',
      },
      { id: 'bls_cpi_u', subset: 'CUUR0000SA0 annual averages, FY2024 = 1.000, used to deflate nominal → real.' },
    ],
  },
  agg_uni_source_split: {
    parquet: 'agg_uni_source_split',
    description: 'Per-university R&D by source category × fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Sources of Funds) per institution × FY × source category, FY2005–FY2024.',
      },
    ],
  },
  agg_uni_agency_split: {
    parquet: 'agg_uni_agency_split',
    description: 'Per-university federal R&D by agency × fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q09 (Federal R&D by Agency) per institution × FY × agency bucket, FY2005–FY2024.',
      },
    ],
  },
  agg_uni_field_mix: {
    parquet: 'agg_uni_field_mix',
    description: 'Per-university R&D by HERD field-of-science category × fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q03 (R&D by Field of Science) per institution × FY × field, FY2005–FY2024.',
      },
    ],
  },
  agg_uni_concentration: {
    parquet: 'agg_uni_concentration',
    description: 'Per-university funding volatility, 5-year coefficient of variation, and national rank × fiscal year.',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Total R&D) used to compute trailing-5yr CoV and rank per institution × FY.',
      },
    ],
  },
  agg_uni_federal_funds: {
    parquet: 'agg_uni_federal_funds',
    description:
      'Per-university bottom-up sum of federal flows (NSF awards + NIH grants + USAS contracts + USAS assistance) × fiscal year for the HERD vs Federal-Funds bridge.',
    sources: [
      { id: 'nsf_awards', subset: 'fact_nsf_award.obligation_fy summed per institution × FY.' },
      { id: 'nih_exporter', subset: 'fact_nih_project.total_cost_nominal summed per institution × FY.' },
      {
        id: 'usaspending',
        subset:
          'Contract obligations + assistance face value summed per recipient (joined to institution_sk via UEI/DUNS), FY2008–FY2024.',
      },
    ],
  },
  agg_uni_growth: {
    parquet: 'agg_uni_growth',
    description:
      'Per-university 5-yr, 10-yr, 20-yr CAGR + rank movement (restricted to FY2024 ≥ $5M cohort to avoid divide-by-tiny).',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Total R&D) snapshots at FY2005/FY2014/FY2019/FY2024 per institution.',
      },
    ],
  },
  agg_uni_nih_ic: {
    parquet: 'agg_uni_nih_ic',
    description: 'Per-university NIH funding by administering Institute/Center × fiscal year.',
    sources: [
      {
        id: 'nih_exporter',
        subset: 'fact_nih_project.total_cost_nominal grouped by admin_ic_code per institution × FY, FY2005–FY2024.',
      },
    ],
  },
  agg_uni_peers: {
    parquet: 'agg_uni_peers',
    description: 'Per-university peer-similarity rankings derived from HERD agency mix + field mix.',
    sources: [
      {
        id: 'ncses_herd',
        subset:
          'Q01 + Q03 + Q09 vectors used to compute cosine similarity between every pair of institutions in the HERD universe.',
      },
    ],
  },
  agg_uni_pi_universe: {
    parquet: 'agg_uni_pi_universe',
    description: 'Per-university distinct federal PI count + $ per PI × fiscal year (NSF lead ∪ NIH lead+co-PIs).',
    sources: [
      { id: 'nsf_awards', subset: 'Lead PI per award (NSF does not publish co-PI bridge).' },
      {
        id: 'nih_exporter',
        subset: 'PI bridge file (one row per project × PI), aggregated to distinct PIs per institution × FY.',
      },
    ],
  },
  agg_uni_pi_metrics: {
    parquet: 'agg_uni_pi_metrics',
    description: 'Per-university PI summary metrics (distinct PI count, $ per PI, mean grants per PI) × fiscal year.',
    sources: [
      { id: 'nsf_awards', subset: 'Lead PI counts + obligations per institution × FY.' },
      { id: 'nih_exporter', subset: 'PI bridge counts + total_cost per institution × FY.' },
    ],
  },
  agg_uni_specialization: {
    parquet: 'agg_uni_specialization',
    description:
      'Per-university × topic × FY specialization score: (uni topic $ ÷ national topic $) ÷ (uni total $ ÷ national total $).',
    sources: [
      { id: 'nsf_awards', subset: 'Tagged grant $ per institution × topic × FY.' },
      { id: 'nih_exporter', subset: 'Tagged grant $ per institution × topic × FY.' },
      { id: 'ncses_herd', subset: 'Q01 Total R&D denominator for the share-of-share normalization.' },
    ],
  },
  agg_uni_state_context: {
    parquet: 'agg_uni_state_context',
    description: "Per-university share of its state's total HERD R&D × fiscal year.",
    sources: [
      { id: 'ncses_herd', subset: 'Q01 (Total R&D) per institution joined to state aggregate.' },
      { id: 'ipeds', subset: 'HD directory: STABBR for each institution_sk.' },
    ],
  },
  agg_uni_subject_tag: {
    parquet: 'agg_uni_subject_tag',
    description: 'Per-university legacy subject-tag aggregation (precursor to agg_uni_topic).',
    sources: [
      { id: 'nsf_awards', subset: 'Title text matched against legacy subject taxonomy.' },
      { id: 'nih_exporter', subset: 'Project title + terms matched against legacy subject taxonomy.' },
    ],
  },
  agg_uni_team_size: {
    parquet: 'agg_uni_team_size',
    description: 'Per-university federal $ by PI team-size bucket × fiscal year.',
    sources: [
      { id: 'nsf_awards', subset: 'n_pi field per award, bucketed.' },
      { id: 'nih_exporter', subset: 'PI bridge count(DISTINCT pi_id) per project, bucketed.' },
    ],
  },
  agg_uni_topic: {
    parquet: 'agg_uni_topic',
    description: 'Per-university federal R&D dollars tagged by 30-topic regex taxonomy × fiscal year.',
    sources: [
      { id: 'nsf_awards', subset: 'awd_titl_txt + awd_abstr_narration text regex-matched per institution × FY.' },
      { id: 'nih_exporter', subset: 'project_title + project_terms text regex-matched per institution × FY.' },
    ],
  },
  agg_uni_patents: {
    parquet: 'agg_uni_patents',
    description:
      'Per-university USPTO patent rollup × CY: granted utility patents, applications filed (PGPub), federally-funded share, industry co-assignment share, 5-yr mature forward citations, primary CPC top section, and HERD R&D denominators for per-$M ratios.',
    sources: [
      {
        id: 'uspto_patentsview',
        subset:
          'g_patent (granted utility patents) + g_assignee_disambiguated (assignee→institution) + g_us_patent_citation (5yr forward window) + pg_published_application (PGPub by first publication CY), CY2005–CY2025. Multi-assignee patents whole-counted per institution; 872 disambiguated assignees crosswalk to 471 HERD institution_sk.',
      },
      {
        id: 'ncses_herd',
        subset:
          'herd_total_rd_M + herd_federal_rd_M denominators for patents_per_M_federal_rd and patents_per_M_total_rd ratios, by FY.',
      },
      {
        id: 'nai_top100',
        subset:
          'External verification anchor only — 89-cell reconciliation against NAI Top-100 published counts; 78% within ±25% after Phase 3 crosswalk patches. Not used in the aggregation itself.',
      },
    ],
  },

  // ─────────────────────── Source-of-truth sheets (master workbook origins) ───────────────────────
  sheet_01_institution_funding_panel: {
    parquet: 'sheet_01_institution_funding_panel',
    description: 'Sheet 1: long-format HERD funding panel (institution × FY × source category).',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Sources of Funds) raw — one row per institution × FY × source category, FY2005–FY2024.',
      },
    ],
  },
  sheet_02_institution_agency: {
    parquet: 'sheet_02_institution_agency',
    description: 'Sheet 2: long-format HERD federal-by-agency panel (institution × FY × agency).',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q09 (Federal R&D by Agency) raw — one row per institution × FY × agency, FY2005–FY2024.',
      },
    ],
  },
  sheet_03_rd_by_field: {
    parquet: 'sheet_03_rd_by_field',
    description: 'Sheet 3: long-format HERD R&D-by-field panel (institution × FY × field).',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q03 (R&D by Field of Science) raw — one row per institution × FY × field, FY2005–FY2024.',
      },
    ],
  },
  sheet_04_federal_rd_by_agency: {
    parquet: 'sheet_04_federal_rd_by_agency',
    description: 'Sheet 4: aggregate federal R&D by agency × fiscal year (national rollup).',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q09 summed across all institutions per FY × agency bucket, FY2005–FY2024.',
      },
    ],
  },
  sheet_05_top_grants_ledger: {
    parquet: 'sheet_05_top_grants_ledger',
    description:
      'Sheet 5: top federal grants ledger (NIH + NSF + USAS contracts + USAS assistance, one row per award).',
    sources: [
      { id: 'nih_exporter', subset: 'Project-level awards, FY2005–FY2024.' },
      { id: 'nsf_awards', subset: 'Award-level data, FY2005–FY2024.' },
      { id: 'usaspending', subset: 'Contract + assistance awards to higher-education recipients, FY2008–FY2024.' },
    ],
  },
  sheet_06_sbir_sttr: {
    parquet: 'sheet_06_sbir_sttr',
    description: 'Sheet 6: SBIR + STTR award ledger (firm-level, with research-institution partner).',
    sources: [
      {
        id: 'sbir_sttr',
        subset: 'All SBIR + STTR Phase I/II awards across 11 participating agencies, FY2005–FY2024.',
      },
    ],
  },
  sheet_07_cross_source_reconciliation: {
    parquet: 'sheet_07_cross_source_reconciliation',
    description: 'Sheet 7: per-university HERD vs bottom-up streams (NIH + NSF + USAS) reconciliation deltas.',
    sources: [
      { id: 'ncses_herd', subset: 'Q09 federal R&D per institution (top-down).' },
      { id: 'nih_exporter', subset: 'Per-institution total per FY (bottom-up).' },
      { id: 'nsf_awards', subset: 'Per-institution obligations per FY (bottom-up).' },
      { id: 'usaspending', subset: 'Per-institution contract + assistance per FY (bottom-up).' },
    ],
  },
  sheet_08_pi_cross_agency_portfolio: {
    parquet: 'sheet_08_pi_cross_agency_portfolio',
    description: 'Sheet 8: PI-level cross-agency portfolio (PIs with both NSF and NIH funding).',
    sources: [
      { id: 'nsf_awards', subset: 'Lead PI per award.' },
      { id: 'nih_exporter', subset: 'PI bridge file (one row per project × PI).' },
    ],
  },
  sheet_09_data_quality: {
    parquet: 'sheet_09_data_quality',
    description: 'Sheet 9: data-quality flags + provenance metadata for every dimension.',
    sources: [
      { id: 'ncses_herd', subset: 'HERD vintage + Q01/Q03/Q09 coverage flags per institution × FY.' },
      { id: 'nih_exporter', subset: 'NIH coverage flags per institution × FY.' },
      { id: 'nsf_awards', subset: 'NSF coverage flags per institution × FY (incl. ~62% pi_sk gap).' },
    ],
  },
  sheet_10_federal_rd_flow: {
    parquet: 'sheet_10_federal_rd_flow',
    description: 'Sheet 10: NCSES Federal Funds explicit obligations + agency × performer crosstab.',
    sources: [
      {
        id: 'ncses_federal_funds',
        subset: 'Table 1 (agency obligations) + Tables 30 series (agency × performer crosstab), FY2005–FY2024.',
      },
    ],
  },
  sheet_11_federal_university_bridge: {
    parquet: 'sheet_11_federal_university_bridge',
    description: 'Sheet 11: HERD-survey vs Federal-Funds bridge reconciliation (per university, three FY values).',
    sources: [
      { id: 'ncses_federal_funds', subset: 'Vol 71 obligations by agency, FY2016–FY2024.' },
      { id: 'ncses_herd', subset: 'Q09 federal R&D reported by university, FY2016–FY2024.' },
    ],
  },
  sheet_12_nih_ic_breakdown: {
    parquet: 'sheet_12_nih_ic_breakdown',
    description: 'Sheet 12: per-institution NIH funding by administering Institute / Center.',
    sources: [
      {
        id: 'nih_exporter',
        subset: 'fact_nih_project.total_cost_nominal grouped by admin_ic_code per institution × FY.',
      },
    ],
  },
  sheet_13_ip_patents: {
    parquet: 'sheet_13_ip_patents',
    description:
      'Sheet 13 (source-of-truth): per-university × CY patent metrics — granted patents, federally-funded share, applications filed, average inventors, industry co-assignment share, 5-year mature forward citations, primary CPC top section, top federal funding agency, HERD R&D denominators, and patents-per-$M ratios. CY2005–CY2025 with truncation flags for late years.',
    sources: [
      {
        id: 'uspto_patentsview',
        subset:
          'Granted utility patents (PVGPATDIS), pre-grant publications (PVPGPUBDIS), forward citations (PVANNUAL). Bayh-Dole government-interest clause parsed for federal-funding flag; CPC primary section extracted from g_cpc_current. 872 disambiguated assignees mapped to 471 HERD institution_sk via 4-stage crosswalk (Appendix-B seeds → direct alias → foundation/regents pattern strip → filtered fuzzy with WRatio ≥ 95 + token-sort ≥ 88 + US-org assignee_type filter).',
      },
      {
        id: 'ncses_herd',
        subset:
          'Q01 total R&D + Q09 federal R&D as denominators for the productivity ratios (patents_per_M_*_rd). Joined on institution_sk × fiscal_year.',
      },
      {
        id: 'nai_top100',
        subset:
          'External verification reference (CY2013–CY2024). Cell-level reconciliation documented in data/docs/ip_verification_report_round2.md.',
      },
    ],
  },

  // ─────────────────────── Dimensions + lookups ───────────────────────
  dim_institution: {
    parquet: 'dim_institution',
    description: 'Canonical institution dimension: surrogate key, name, UEI, OPEID, IPEDS UNITID, state, sector.',
    sources: [
      { id: 'ipeds', subset: 'HD directory: UNITID, OPEID, INSTNM, STABBR, SECTOR, CONTROL.' },
      { id: 'usaspending', subset: 'UEI assignment + transition history (legacy DUNS).' },
      { id: 'ncses_herd', subset: 'HERD institution_id ↔ institution_sk crosswalk.' },
    ],
  },
  dim_institution_crosswalk: {
    parquet: 'dim_institution_crosswalk',
    description: 'Federal-grants (NSF/NIH) institution_sk ↔ HERD institution_sk crosswalk.',
    sources: [
      { id: 'nsf_awards', subset: 'Awardee org + UEI per award.' },
      { id: 'nih_exporter', subset: 'org_name + DUNS/UEI per project.' },
      { id: 'ncses_herd', subset: 'HERD institution_sk universe.' },
      { id: 'ipeds', subset: 'UEI + UNITID + canonical name for fuzzy matching.' },
    ],
  },
  dim_agency: {
    parquet: 'dim_agency',
    description: 'Canonical agency dimension: top-level department, sub-agency, taxonomy version (Vol 70/71).',
    sources: [{ id: 'ncses_federal_funds', subset: 'Vol 70/71 agency hierarchy + taxonomy break flags.' }],
  },
  cpi_u_annual: {
    parquet: 'cpi_u_annual',
    description: 'BLS CPI-U annual averages (deflator series for nominal → real-FY2024 conversion).',
    sources: [
      {
        id: 'bls_cpi_u',
        subset: 'Series CUUR0000SA0 (all items, all urban, not seasonally adjusted), annual averages.',
      },
    ],
  },
};

/**
 * Look up upstream sources for a given parquet file.
 * Returns an empty array if the parquet is not registered (treat as
 * "implementation detail" — never render a citation, never silently default).
 */
export function getSources(parquet: string): SourceCitation[] {
  return PARQUET_SOURCES[parquet]?.sources ?? [];
}

/** Get the provenance entry for a parquet, or null if unregistered. */
export function getProvenance(parquet: string): ParquetProvenance | null {
  return PARQUET_SOURCES[parquet] ?? null;
}
