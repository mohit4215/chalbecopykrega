import type { Metadata } from 'next';
import './globals.css';
import CookieConsent from '../components/CookieConsent';
import AnalyticsTracker from '../components/AnalyticsTracker';

export const metadata: Metadata = {
  metadataBase: new URL('https://chalbecopykrega-app.onrender.com'),
  title: {
    default: 'Poach | Next-Gen AI & Web Plagiarism Detection Engine',
    template: '%s | Poach',
  },
  description:
    'Audit research papers, student essays, and scanned PDFs against billions of web pages and institutional archives. High-precision vector similarity with zero paper retention.',
  keywords: [
    'plagiarism checker',
    'turnitin alternative',
    'originality verification',
    'academic integrity',
    'research paper scanner',
    'OCR PDF plagiarism check',
    'sentence embeddings',
    'ONNX inference',
    'vector similarity search',
  ],
  authors: [{ name: 'Poach Technologies', url: 'https://chalbecopykrega-app.onrender.com' }],
  creator: 'Poach Technologies',
  publisher: 'Poach Technologies',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Poach | Next-Gen AI & Web Plagiarism Detection Engine',
    description:
      'Audit academic research papers, student essays, and scanned PDFs against billions of web pages with sub-second ONNX neural search.',
    url: 'https://chalbecopykrega-app.onrender.com',
    siteName: 'Poach',
    images: [
      {
        url: 'https://chalbecopykrega-app.onrender.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Poach Plagiarism Detection Dashboard & Originality Report',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Poach | Next-Gen Plagiarism & Originality Checker',
    description:
      'Scan research papers and scanned PDFs with neural ONNX embeddings and real-time web indexing. Zero data retention.',
    images: ['https://chalbecopykrega-app.onrender.com/og-image.png'],
    creator: '@poach_ai',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Poach',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
    description:
      'High-precision plagiarism and originality verification for academic research papers, essays, and scanned PDFs.',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '1240',
    },
    featureList: [
      'Digital & Scanned PDF OCR extraction',
      'ONNX Runtime 384-dimensional dense sentence embeddings',
      'Real-time live internet search indexing',
      'Zero paper repository retention for privacy',
      'Stripe-powered Pro subscriptions and Pay-As-You-Go packs',
    ],
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">
        {/* Dynamic GDPR Tracker: Blocked by default until explicit consent */}
        <AnalyticsTracker />

        {children}

        {/* GDPR-compliant Cookie Consent Banner */}
        <CookieConsent />
      </body>
    </html>
  );
}
