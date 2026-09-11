import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Random Video Chat',
    description: 'Meet new people around the world',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="th">
            <body>{children}</body>
        </html>
    )
}
