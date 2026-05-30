import { Footer } from '@/components/layout/Footer';
import { MegaNav } from '@/components/layout/MegaNav';
import '@fontsource/carlito/400.css';
import '@fontsource/carlito/400-italic.css';
import '@fontsource/carlito/700.css';
import '@fontsource/carlito/700-italic.css';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Research Data Platform · Federal R&D Funding',
    template: '%s · Research Data Platform',
  },
  description:
    'Explore 20 years (FY2005–FY2024) of federal research funding to U.S. universities. HERD, USAS, NIH, NSF, SBIR, Federal Funds — all reconciled, all open.',
  openGraph: {
    title: 'Research Data Platform · Federal R&D Funding',
    description: 'Federal research funding to U.S. universities, 2005–2024.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className=""
    >
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-surface-elevated"
        >
          Skip to content
        </a>
        <Providers>
          <MegaNav />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
