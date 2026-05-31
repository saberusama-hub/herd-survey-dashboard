import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import manifest from '@/public/manifest.json' assert { type: 'json' };
import { Download } from 'lucide-react';

export const metadata = {
  title: 'Downloads',
  description: 'Download the underlying parquet bundles, the master Excel workbook, and the QA reports.',
};

interface ManifestFile {
  rows: number;
  size_bytes: number;
  sha256: string;
  columns: { name: string; type: string }[];
}

export default function DownloadsPage() {
  const files = manifest.files as Record<string, ManifestFile>;
  const totalBytes = Object.values(files).reduce((sum, f) => sum + f.size_bytes, 0);

  const sheets = Object.entries(files)
    .filter(([k]) => k.startsWith('sheet_'))
    .sort(([a], [b]) => a.localeCompare(b));
  const dims = Object.entries(files).filter(([k]) => !k.startsWith('sheet_'));

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Open data"
        title="Downloads"
        description="Every parquet file the dashboard queries is downloadable. Built on this exact data the dashboard runs on."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border">
        <Tile label="Total files" value={String(Object.keys(files).length)} />
        <Tile label="Total size" value={`${(totalBytes / 1024 / 1024).toFixed(1)} MB`} />
        <Tile label="Compression" value="ZSTD" />
        <Tile label="Built" value={manifest.built_at_utc.slice(0, 10)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sheet parquet files (12)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <FileTable files={sheets} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dimensions + lookups</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <FileTable files={dims} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary mb-3">
            The <code className="text-xs bg-accent-muted/40 px-1 rounded">manifest.json</code> records every file's row
            count, byte size, SHA-256, full column schema, and headline KPIs. Use it to verify integrity after download.
          </p>
          <a
            href="/manifest.json"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
            download
          >
            <Download className="h-4 w-4" /> Download manifest.json
          </a>
        </CardContent>
      </Card>

      <p className="text-xs text-text-tertiary">
        All files are ZSTD-compressed Parquet readable by DuckDB, pandas, polars, PyArrow, Arrow, etc.
      </p>
    </div>
  );
}

function FileTable({ files }: { files: [string, ManifestFile][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th className="text-left font-medium px-3 md:px-6 py-3">File</th>
            <th className="text-right font-medium px-3 md:px-6 py-3">Rows</th>
            <th className="text-right font-medium px-3 md:px-6 py-3">Size</th>
            <th className="text-right font-medium px-3 md:px-6 py-3">Columns</th>
            <th className="text-right font-medium px-3 md:px-6 py-3">Download</th>
          </tr>
        </thead>
        <tbody>
          {files.map(([name, info]) => (
            <tr key={name} className="border-b border-border/60 last:border-0 hover:bg-accent-muted/20">
              <td className="px-3 md:px-6 py-2.5 font-mono text-xs">{name}.parquet</td>
              <td className="px-3 md:px-6 py-2.5 text-right tabular-nums">{info.rows.toLocaleString('en-US')}</td>
              <td className="px-3 md:px-6 py-2.5 text-right tabular-nums text-text-secondary">
                {(info.size_bytes / 1024).toFixed(0)} KB
              </td>
              <td className="px-3 md:px-6 py-2.5 text-right tabular-nums text-text-tertiary">{info.columns.length}</td>
              <td className="px-3 md:px-6 py-2.5 text-right">
                <a
                  href={`/data/${name}.parquet`}
                  download
                  className="inline-flex items-center gap-1.5 text-accent hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> .parquet
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-elevated p-5">
      <div className="h-card mb-2">{label}</div>
      <div className="text-2xl font-medium tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
