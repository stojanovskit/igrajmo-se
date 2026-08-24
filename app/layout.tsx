import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://igrajmo-se.stojanovskit2022.workers.dev'),
  title: 'Играјмо — Друштвени игри онлајн',
  description: 'Играј класични друштвени игри со пријатели и нови противници — бесплатно и на македонски.',
  openGraph: {
    type: 'website',
    locale: 'mk_MK',
    title: 'Играјмо — Друштвото е тука.',
    description: 'Класични игри. Вистински противници. Бесплатно и на македонски.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Играјмо — Друштвото е тука.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Играјмо — Друштвото е тука.',
    description: 'Класични игри. Вистински противници.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mk">
      <body>{children}</body>
    </html>
  );
}

