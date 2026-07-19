import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'ViralizaHost — Hospedagem Web Premium',
    template: '%s | ViralizaHost',
  },
  description: 'Hospedagem web premium com LiteSpeed, NVMe SSD, cPanel e suporte 24/7. Planos a partir de Kz 4.500/mês. Uptime 99.9% garantido.',
  keywords: ['hospedagem web', 'hosting angola', 'hosting brasil', 'cpanel', 'domínios', 'email corporativo', 'ssl grátis'],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'ViralizaHost — Hospedagem Web Premium',
    description: 'Hospedagem web premium com LiteSpeed, NVMe SSD e suporte 24/7.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
