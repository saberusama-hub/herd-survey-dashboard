'use client';

import * as duckdb from '@duckdb/duckdb-wasm';
import type { Row } from './types';

const CDN = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: `${CDN}/duckdb-mvp.wasm`,
    mainWorker: `${CDN}/duckdb-browser-mvp.worker.js`,
  },
  eh: {
    mainModule: `${CDN}/duckdb-eh.wasm`,
    mainWorker: `${CDN}/duckdb-browser-eh.worker.js`,
  },
};

// Browser-side parquet files registered as views under these basenames.
const PARQUET_FILES = [
  'sheet_01_institution_funding_panel',
  'sheet_02_institution_agency',
  'sheet_03_rd_by_field',
  'sheet_04_federal_rd_by_agency',
  'sheet_05_top_grants_ledger',
  'sheet_06_sbir_sttr',
  'sheet_07_cross_source_reconciliation',
  'sheet_08_pi_cross_agency_portfolio',
  'sheet_09_data_quality',
  'sheet_10_federal_rd_flow',
  'sheet_11_federal_university_bridge',
  'sheet_12_nih_ic_breakdown',
  'dim_institution',
  'dim_agency',
  'cpi_u_annual',
];

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

async function init(): Promise<duckdb.AsyncDuckDBConnection> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  // Wrap worker in a Blob URL so it's treated as same-origin.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  conn = await db.connect();

  for (const name of PARQUET_FILES) {
    const fileUrl = `${window.location.origin}/data/${name}.parquet`;
    await db.registerFileURL(`${name}.parquet`, fileUrl, duckdb.DuckDBDataProtocol.HTTP, false);
    await conn.query(`CREATE OR REPLACE VIEW ${name} AS SELECT * FROM '${name}.parquet'`);
  }

  return conn;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  if (!initPromise) initPromise = init();
  return initPromise;
}

/**
 * Convert DuckDB int64 / hugeint columns (returned as JS BigInt) into regular
 * Number. JS BigInt does not arithmetic-mix with Number (Array.sort comparators
 * crash; `a - b` throws), so we normalize at the query boundary.
 *
 * Values outside Number.MAX_SAFE_INTEGER would lose precision in this
 * conversion, but our domain (fiscal years, dollar amounts up to ~$1T) is
 * comfortably inside the 2^53 safe integer range.
 */
function normalizeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalizeBigInt);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeBigInt(v);
    }
    return out;
  }
  return value;
}

export async function query<T extends Row = Row>(sql: string): Promise<T[]> {
  const c = await getConnection();
  const result = await c.query(sql);
  return result.toArray().map((row) => normalizeBigInt(row.toJSON()) as T);
}

export async function queryOne<T extends Row = Row>(sql: string): Promise<T | null> {
  const rows = await query<T>(sql);
  return rows[0] ?? null;
}

export async function close(): Promise<void> {
  if (conn) await conn.close();
  if (db) await db.terminate();
  conn = null;
  db = null;
  initPromise = null;
}
