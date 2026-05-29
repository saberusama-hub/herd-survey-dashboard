import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  plannedFor: string;
}

export function ComingSoon({ eyebrow, title, description, plannedFor }: Props) {
  return (
    <div className="container-narrow py-10 md:py-14 space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <Badge variant="outline">Coming in {plannedFor}</Badge>
          <p className="text-text-secondary">
            This page is part of the Phase 2 build. In the meantime, the data is already in the bundle —{' '}
            <Link href="/downloads/" className="text-accent hover:underline">
              download the parquet
            </Link>{' '}
            or query it via the MCP server in claude.ai (Plan 03).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
