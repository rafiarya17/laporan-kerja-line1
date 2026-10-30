import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "LKH Berlindo", description: "Laporan Harian Kerja Berlindo", robots: { index: false, follow: false } };
export default function RootLayout({children}: {children: React.ReactNode}) { return <html lang="id"><body>{children}</body></html>; }
