/** Manifest written by scripts/build_data.py */
export interface DataManifest {
  built_at_utc: string;
  source_dir: string;
  files: Record<string, ManifestFile>;
  kpis: ManifestKpis;
}

export interface ManifestFile {
  rows: number;
  size_bytes: number;
  sha256: string;
  columns: { name: string; type: string }[];
}

export interface ManifestKpis {
  fy2024_federal_obligations_usd: number;
  fy2024_bottom_up_usd: number;
  n_universities: number;
  n_agencies: number;
  fy_min: number;
  fy_max: number;
}

/** Generic typed row from a DuckDB query */
export type Row = Record<string, unknown>;

export interface Institution {
  institution_sk: string;
  canonical_name: string;
  primary_state: string | null;
}

export interface Agency {
  agency_sk: string;
  agency_name: string;
}
