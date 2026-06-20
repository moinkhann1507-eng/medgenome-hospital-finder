import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "MedGenome Hospital Finder — PAN India",
  description: "Find 30,000+ hospitals across India with AI-powered search",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
