import Link from 'next/link';

export const metadata = { title: 'Moved to Agency profile' };

/**
 * Legacy /nih route. The NIH IC breakdown moved into the Agency profile
 * (U-5 IA refactor) — surfaced on the HHS/NIH agency detail page.
 */
export default function NihRedirect() {
  return (
    <>
      <meta httpEquiv="refresh" content="0; url=/agency/" />
      <div className="container-narrow py-20 text-text-secondary space-y-3">
        <p>The NIH IC breakdown moved into the Agency profile.</p>
        <p>
          Continue to{' '}
          <Link href="/agency" className="text-accent underline">
            /agency
          </Link>
          .
        </p>
      </div>
    </>
  );
}
