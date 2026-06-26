import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Trading PWA',
  description: 'Advanced Trading View Clone with Replay',
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#131722',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background`}>{children}</body>
    </html>
  )
}
