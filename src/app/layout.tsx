import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LocaleSync } from '@/providers/LocaleSync'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const SITE_URL = 'https://viralizahost.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ViralizaHost — Hospedagem Web Premium',
    template: '%s | ViralizaHost',
  },
  description: 'Hospedagem web premium com LiteSpeed, NVMe SSD, cPanel e suporte 24/7. Planos a partir de Kz 4.500/mês. Uptime 99.9% garantido.',
  keywords: ['hospedagem web', 'hosting angola', 'hosting brasil', 'cpanel', 'domínios', 'email corporativo', 'ssl grátis'],

  /* ── Favicon & icons ─────────────────────────────────────────
   * src/app/favicon.ico       → served at /favicon.ico (auto)
   * src/app/icon.png          → served at /icon.png    (auto)
   * src/app/apple-icon.png    → served at /apple-icon.png (auto)
   * All generated from public/favicon.svg by gen-icons.cjs
   */
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg',      type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32',   type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16',   type: 'image/png' },
      { url: '/icon-192.png',      sizes: '192x192',  type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },

  /* ── Open Graph (WhatsApp, Facebook, LinkedIn, Telegram) ───── */
  openGraph: {
    title:       'ViralizaHost — Hospedagem Web Premium',
    description: 'Hospedagem web, domínios e e-mails corporativos para empresas em Angola e Brasil. LiteSpeed, NVMe SSD, cPanel e suporte 24/7.',
    url:         SITE_URL,
    siteName:    'ViralizaHost',
    type:        'website',
    locale:      'pt_PT',
    images: [
      {
        url:    '/og-image.png',
        width:   1200,
        height:  630,
        alt:    'ViralizaHost — Hospedagem Web Premium',
        type:   'image/png',
      },
    ],
  },

  /* ── Twitter / X Card ───────────────────────────────────────── */
  twitter: {
    card:        'summary_large_image',
    title:       'ViralizaHost — Hospedagem Web Premium',
    description: 'Hospedagem web, domínios e e-mails corporativos para Angola e Brasil.',
    images:      ['/og-image.png'],
  },

  /* ── Robots ─────────────────────────────────────────────────── */
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <LocaleSync />
        {children}
      </body>
    </html>
  )
}
