import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['hospedagem', 'hosting', 'domínios', 'email', 'cPanel', 'Angola', 'Brasil'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
