import Link from 'next/link';

export const metadata = { title: 'Moved to /map' };

/**
 * Legacy /states route. The State Map moved to /map (U-5 IA refactor).
 * Static page with a client-side redirect via <meta http-equiv="refresh"> and a manual link.
 */
export default function StatesRedirect() {
  return (
    <>
      <meta httpEquiv="refresh" content="0; url=/map/" />
      <div className="container-narrow py-20 text-text-secondary space-y-3">
        <p>The state map moved to a shorter URL.</p>
        <p>
          Continue to{' '}
          <Link href="/map" className="text-accent underline">
            /map
          </Link>
          .
        </p>
      </div>
    </>
  );
}
