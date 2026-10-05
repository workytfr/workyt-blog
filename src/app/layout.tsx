import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Funnel_Display, Montserrat } from "next/font/google";
import "./globals.css";
import { SITE, pageTitle } from "@/lib/site";
import Providers from "@/components/Providers";
import { getSettings } from "@/lib/settings";
import { THEME_SCRIPT } from "@/lib/theme";

// Polices de Workyt, et seulement elles
const funnelDisplay = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

/** Description et vérifications des moteurs : réglages du dashboard (Admin) */
export async function generateMetadata(): Promise<Metadata> {
    const s = await getSettings();
    return {
        metadataBase: new URL(SITE.url),
        title: { default: pageTitle(SITE.tagline), template: `%s ${SITE.titleSeparator} ${SITE.name}` },
        description: s.description,
        alternates: { types: { "application/rss+xml": `${SITE.url}/feed/` } },
        verification: {
            ...(s.verification.google ? { google: s.verification.google } : {}),
            ...(s.verification.bing ? { other: { "msvalidate.01": s.verification.bing } } : {}),
        },
        openGraph: { siteName: SITE.name, locale: SITE.locale, type: "website" },
    };
}

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#fdfaf4" },
        { media: "(prefers-color-scheme: dark)", color: "#16120f" },
    ],
};

const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL?.replace(/\/$/, "");
const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        // suppressHydrationWarning : le script du thème ajoute « dark » avant React
        <html lang="fr" className={`${funnelDisplay.variable} ${montserrat.variable}`} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className="min-h-screen bg-paper font-sans text-ink antialiased">
                <Providers>
                    {children}
                </Providers>
                {/* Mesure d'audience Umami (sans cookie) : stats.youss.dev */}
                {umamiUrl && umamiId && <Script src={`${umamiUrl}/script.js`} data-website-id={umamiId} strategy="afterInteractive" />}
            </body>
        </html>
    );
}
