/**
 * Federal raw-data source registry.
 *
 * Every chart, KPI, and table on the dashboard cites one or more of these
 * upstream federal sources via the {@link SourceCitation} type. A reader who
 * Googles `googleQuery` should land on the dataset homepage; following
 * `rawDataUrl` should produce the exact archive the ETL pulled.
 *
 * This registry is the single source of truth for citation copy across the UI.
 * If a publisher releases a new edition or moves a URL, change it here once.
 */

export type SourceId =
  | 'ncses_herd'
  | 'ncses_federal_funds'
  | 'nih_exporter'
  | 'nsf_awards'
  | 'usaspending'
  | 'sbir_sttr'
  | 'ipeds'
  | 'bls_cpi_u'
  | 'uspto_patentsview'
  | 'nai_top100';

export interface FederalSource {
  /** Stable identifier used in cross-references. */
  id: SourceId;
  /** Display name (short, used in citations). */
  shortName: string;
  /** Long publisher name. */
  publisher: string;
  /** Publisher acronym (used in compact citations). */
  publisherAcronym: string;
  /** Dataset / survey name as the publisher labels it. */
  dataset: string;
  /** Latest publication identifier when applicable (e.g., "NSF 24-330"). */
  identifier?: string;
  /** Dataset homepage / landing URL. */
  homeUrl: string;
  /** Direct link to the raw data archive download page. */
  rawDataUrl: string;
  /** Optional public API endpoint for the dataset. */
  apiUrl?: string;
  /** Time coverage (publisher-side) and the subset we use. */
  coverage: string;
  /** Update cadence. */
  cadence: string;
  /** Data license / use terms. */
  license: string;
  /** One-paragraph description of what the dataset is. */
  description: string;
  /** Google query that surfaces the dataset homepage. */
  googleQuery: string;
  /** Step-by-step instructions to retrieve the raw archive a reader could verify against. */
  howToFindRaw: string;
}

export const SOURCES: Record<SourceId, FederalSource> = {
  ncses_herd: {
    id: 'ncses_herd',
    shortName: 'NCSES HERD Survey',
    publisher: 'National Center for Science and Engineering Statistics (NSF)',
    publisherAcronym: 'NCSES',
    dataset: 'Higher Education Research and Development (HERD) Survey',
    identifier: 'NSF 24-330 (FY2023 InfoBrief + data tables)',
    homeUrl: 'https://ncses.nsf.gov/surveys/higher-education-research-development',
    rawDataUrl: 'https://ncses.nsf.gov/surveys/higher-education-research-development/2023',
    apiUrl: 'https://ncsesdata.nsf.gov/builder/herd',
    coverage: 'FY1972–present; this dashboard uses FY2005–FY2024',
    cadence: 'Annual; final tables published ~18 months after FY close',
    license: 'Public domain (U.S. federal government, NSF NCSES)',
    description:
      'Annual institution-level census of R&D expenditures at every U.S. doctorate-granting university (~1,000 reporters). Self-reported by Sponsored Programs offices. The HERD universe is the canonical "U.S. university R&D" measurement.',
    googleQuery: 'NCSES HERD Higher Education Research Development Survey data tables',
    howToFindRaw:
      'Open https://ncses.nsf.gov/surveys/higher-education-research-development, click the latest publication (e.g., "FY 2023 — NSF 24-330"), then download the data-tables ZIP. Each table is a labeled Excel sheet (Tables 1-90). Q01 = sources of funds; Q03 = R&D by field; Q09 = federal R&D by agency.',
  },

  ncses_federal_funds: {
    id: 'ncses_federal_funds',
    shortName: 'NCSES Federal Funds for R&D',
    publisher: 'National Center for Science and Engineering Statistics (NSF)',
    publisherAcronym: 'NCSES',
    dataset: 'Federal Funds for Research and Development Survey',
    identifier: 'NSF 24-326 (FY2023-FY2024 actuals + FY2025 estimates)',
    homeUrl: 'https://ncses.nsf.gov/surveys/federal-funds-research-development',
    rawDataUrl: 'https://ncses.nsf.gov/surveys/federal-funds-research-development/2024',
    coverage: 'FY1951–present; this dashboard uses FY2005–FY2024',
    cadence: 'Annual; obligations + outlays by federal agency',
    license: 'Public domain (U.S. federal government, NSF NCSES)',
    description:
      'Agency-reported federal R&D obligations and outlays — the "top-down" view of federal R&D. Used for the bridge reconciliation against HERD (institution-side) and for sub-agency taxonomy (the Vol 70/71 break).',
    googleQuery: 'NCSES Federal Funds Research Development Survey data tables',
    howToFindRaw:
      'Open https://ncses.nsf.gov/surveys/federal-funds-research-development, click the latest publication (NSF 24-326), then download the data-tables ZIP. Table 1 = federal R&D obligations by agency; Tables in the 30 series = agency × performer crosstabs.',
  },

  nih_exporter: {
    id: 'nih_exporter',
    shortName: 'NIH ExPORTER',
    publisher: 'National Institutes of Health (NIH), Office of Extramural Research',
    publisherAcronym: 'NIH',
    dataset: 'NIH ExPORTER Project Data Files (NIH RePORTER bulk download)',
    homeUrl: 'https://reporter.nih.gov/exporter',
    rawDataUrl: 'https://reporter.nih.gov/exporter/projects',
    apiUrl: 'https://api.reporter.nih.gov/',
    coverage: 'FY1985–present; this dashboard uses FY2005–FY2024',
    cadence: 'Weekly delta updates; annual snapshot files',
    license: 'Public domain (U.S. federal government, NIH)',
    description:
      'Project-level data on every NIH-funded extramural award: administering Institute/Center, PI(s), project title, abstract, terms, dates, direct + indirect cost. Includes a Project PI bridge (one row per project × PI) that lets us count distinct PIs and team sizes precisely.',
    googleQuery: 'NIH ExPORTER bulk download project data files',
    howToFindRaw:
      'Open https://reporter.nih.gov/exporter and download "Projects" CSV/ZIP per fiscal year. The "PIs" bridge file (one row per project × investigator) lives in the same downloads page. Also available: PROJECT_NUMBER joins to fact_nih_project.',
  },

  nsf_awards: {
    id: 'nsf_awards',
    shortName: 'NSF Award Search',
    publisher: 'U.S. National Science Foundation, Office of Budget, Finance, and Award Management',
    publisherAcronym: 'NSF',
    dataset: 'NSF Awards bulk download (Award Search)',
    homeUrl: 'https://www.nsf.gov/awardsearch/',
    rawDataUrl: 'https://www.nsf.gov/awardsearch/download.jsp',
    apiUrl: 'https://api.nsf.gov/services/v1/awards',
    coverage: '1959–present; this dashboard uses FY2005–FY2024',
    cadence: 'Nightly rebuild',
    license: 'Public domain (U.S. federal government, NSF)',
    description:
      'Award-level data for every NSF grant: title, abstract, PI (lead only; co-PIs available via the API but not the bulk export), institution, obligation amount by fiscal year, directorate/program. Entire historical archive was retroactively re-encoded as JSON in 2025 (prior XML schema is deprecated).',
    googleQuery: 'NSF Award Search bulk download annual',
    howToFindRaw:
      'Open https://www.nsf.gov/awardsearch/download.jsp and download the year-specific ZIPs (one JSON file per award). The same data is available via the Award Search API at https://api.nsf.gov/services/v1/awards.json with filters like agency, fiscal year, awardee org.',
  },

  usaspending: {
    id: 'usaspending',
    shortName: 'USAspending.gov',
    publisher: 'U.S. Department of the Treasury, Bureau of the Fiscal Service (oversight by OMB)',
    publisherAcronym: 'Treasury',
    dataset: 'USAspending.gov Federal Contracts + Assistance Awards',
    homeUrl: 'https://www.usaspending.gov/',
    rawDataUrl: 'https://www.usaspending.gov/download_center/custom_award_data',
    apiUrl: 'https://api.usaspending.gov/',
    coverage: 'FY2008–present (comprehensive); earlier records sparse',
    cadence: 'Daily',
    license: 'Public domain (DATA Act of 2014)',
    description:
      'Government-wide federal contracts and assistance (grants, cooperative agreements, loans, other financial assistance). Award-level + transaction-level. Used for the bottom-up sum of federal flows to universities in the reconciliation view.',
    googleQuery: 'USAspending custom award download contracts assistance',
    howToFindRaw:
      'Open https://www.usaspending.gov/download_center/custom_award_data, filter by Recipient Type = Higher Education (and/or specific recipient UEI), set Action Date FY range, and download the CSV/ZIP. Includes both contracts (procurement) and assistance (grants/cooperative agreements).',
  },

  sbir_sttr: {
    id: 'sbir_sttr',
    shortName: 'SBIR/STTR Awards (SBA)',
    publisher: 'U.S. Small Business Administration (SBA), Office of Investment and Innovation',
    publisherAcronym: 'SBA',
    dataset: 'SBIR/STTR Awards Database',
    homeUrl: 'https://www.sbir.gov/awards',
    rawDataUrl: 'https://www.sbir.gov/awards/api/foa',
    apiUrl: 'https://api.www.sbir.gov/public/api/awards',
    coverage: '1983–present; this dashboard uses FY2005–FY2024',
    cadence: 'Daily updates',
    license: 'Public domain (U.S. federal government, SBA)',
    description:
      'Small Business Innovation Research (SBIR) and Small Business Technology Transfer (STTR) awards across 11 participating federal agencies. STTR mandates a partnered research institution (typically a university). Includes firm metadata, set-aside flags (woman-owned, HUBZone, disadvantaged), phase, and award amount.',
    googleQuery: 'SBIR STTR awards bulk download SBA',
    howToFindRaw:
      'Open https://www.sbir.gov/awards and use the Advanced Search to filter by agency, year, phase, etc. For bulk: hit https://api.www.sbir.gov/public/api/awards with paginated requests (limit=1000), or download the awards data dump from the same URL with format=json.',
  },

  ipeds: {
    id: 'ipeds',
    shortName: 'IPEDS',
    publisher: 'National Center for Education Statistics (NCES), U.S. Department of Education',
    publisherAcronym: 'NCES',
    dataset: 'Integrated Postsecondary Education Data System (IPEDS)',
    homeUrl: 'https://nces.ed.gov/ipeds/use-the-data',
    rawDataUrl: 'https://nces.ed.gov/ipeds/use-the-data/download-access-database',
    coverage: '1980–present',
    cadence: 'Annual (multiple component surveys)',
    license: 'Public domain (U.S. federal government, U.S. Department of Education)',
    description:
      'Federal universe of postsecondary institutions: name, OPEID, UNITID, sector, state, control, level. The "directory" file (HD) is what we use to attach state codes and metadata to HERD/NSF/NIH institution surrogate keys.',
    googleQuery: 'IPEDS NCES Integrated Postsecondary Education Data System download',
    howToFindRaw:
      'Open https://nces.ed.gov/ipeds/use-the-data/download-access-database, pick a survey year, and download the Access database or component CSV files. Directory file (HDYYYY) has UNITID, OPEID, INSTNM, ADDR, STABBR.',
  },

  uspto_patentsview: {
    id: 'uspto_patentsview',
    shortName: 'USPTO PatentsView',
    publisher: 'U.S. Patent and Trademark Office (USPTO), Office of the Chief Economist',
    publisherAcronym: 'USPTO',
    dataset: 'PatentsView bulk-data products (PVGPATDIS granted patents, PVPGPUBDIS pre-grant publications, PVANNUAL citation graph)',
    homeUrl: 'https://patentsview.org/',
    rawDataUrl: 'https://data.uspto.gov/bulkdata/datasets/pvgpatdis',
    apiUrl: 'https://search.patentsview.org/api/v1',
    coverage: '1976–present for granted patents; pre-grant publications from 2001; this dashboard uses CY2005–CY2025 granted utility patents + CY2005–CY2024 published applications.',
    cadence: 'Quarterly disambiguated; annual citation rebuilds',
    license: 'CC-BY 4.0 (free reuse with attribution)',
    description:
      'USPTO bulk-data products with author-disambiguated assignees, inventors, locations, classifications (CPC + USPC), and the full forward-citation graph. The disambiguated assignee table is the canonical hook for mapping patents to universities — we map ~872 university-affiliated assignee strings to 471 HERD institutions via an explicit alias/seed crosswalk + filtered fuzzy match.',
    googleQuery: 'USPTO PatentsView bulk data download granted patents pre-grant publications',
    howToFindRaw:
      'Open https://data.uspto.gov/bulkdata/datasets/pvgpatdis and download g_patent.tsv.zip, g_assignee_disambiguated.tsv.zip, g_inventor_disambiguated.tsv.zip, g_cpc_current.tsv.zip, g_us_patent_citation.tsv.zip. Pre-grant pubs at /pvpgpubdis; annual citation cohort at /pvannual. Files are tab-separated with explicit type metadata in PatentsView dictionary.',
  },

  nai_top100: {
    id: 'nai_top100',
    shortName: 'NAI Top 100 Universities',
    publisher: 'National Academy of Inventors (NAI), with USPTO data partnership',
    publisherAcronym: 'NAI',
    dataset: 'Top 100 Worldwide Universities Granted U.S. Utility Patents (annual)',
    homeUrl: 'https://academyofinventors.org/top-100-universities/',
    rawDataUrl: 'https://academyofinventors.org/wp-content/uploads/2024/06/Top-100-Worldwide-Universities-2023.pdf',
    coverage: 'CY2013–CY2024 annual rankings',
    cadence: 'Annual (released ~mid-following-CY)',
    license: 'NAI publication, USPTO public-domain data underneath; we use the published counts for external verification only',
    description:
      "Annual NAI ranking of the top 100 universities worldwide by U.S. utility patents granted. Used in this dashboard purely as an external verification anchor for the USPTO PatentsView aggregation: cell-level reconciliation of NAI counts vs. our (institution × CY) totals. Methodology divergence (NAI's first-named-assignee pre-2022 / all-inventors post-2022 vs. our distinct-assignee whole-counting) creates a small known variance.",
    googleQuery: 'National Academy of Inventors Top 100 Worldwide Universities U.S. utility patents granted',
    howToFindRaw:
      'NAI publishes a PDF each June with the CY-1 ranking at https://academyofinventors.org/top-100-universities/. CY2018–CY2019 are only available as HTML tables on the NAI site. Counts are first-named-assignee through CY2021, all-inventors from CY2022 onward — see ip_verification_report_round2.md for the methodology-divergence cells.',
  },

  bls_cpi_u: {
    id: 'bls_cpi_u',
    shortName: 'BLS CPI-U',
    publisher: 'U.S. Bureau of Labor Statistics, Consumer Price Index Program',
    publisherAcronym: 'BLS',
    dataset: 'Consumer Price Index for All Urban Consumers (CPI-U), U.S. City Average',
    identifier: 'Series CUUR0000SA0 (all items, all urban consumers, not seasonally adjusted)',
    homeUrl: 'https://www.bls.gov/cpi/',
    rawDataUrl: 'https://www.bls.gov/cpi/data.htm',
    apiUrl: 'https://api.bls.gov/publicAPI/v2/timeseries/data/',
    coverage: 'Monthly 1913–present; this dashboard uses annual averages FY2005–FY2024',
    cadence: 'Monthly (release ~mid-following-month)',
    license: 'Public domain (U.S. federal government, BLS)',
    description:
      'Headline U.S. inflation measure (CPI-U, U.S. city average, all items, not seasonally adjusted). Used to deflate nominal dollar series to FY2024 constant dollars throughout the dashboard.',
    googleQuery: 'BLS CPI-U all urban consumers annual average data download',
    howToFindRaw:
      'Open https://www.bls.gov/cpi/data.htm, select "Top picks" → "All items in U.S. city average, all urban consumers, not seasonally adjusted" (series CUUR0000SA0), and download annual averages. Or query the BLS API directly with series CUUR0000SA0.',
  },
};

export function getSource(id: SourceId): FederalSource {
  return SOURCES[id];
}

/**
 * A citation attached to a chart/KPI/table. Records (a) which upstream source,
 * (b) what subset within the source the visualization uses (table number,
 * column, year filter), and optionally (c) a deeper URL override.
 */
export interface SourceCitation {
  /** Federal raw source identifier from {@link SOURCES}. */
  id: SourceId;
  /** What's pulled from the source — table name, column, year filter, etc. */
  subset?: string;
  /** Optional URL override (e.g., a specific publication PDF or API endpoint). */
  url?: string;
}

/** Helper to construct a citation array inline. */
export function cite(...citations: SourceCitation[]): SourceCitation[] {
  return citations;
}
