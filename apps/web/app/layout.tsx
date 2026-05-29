import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import type { Metadata } from 'next';
import { fontMono, fontSans } from './fonts';
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
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
