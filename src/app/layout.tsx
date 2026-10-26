import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/shared/toaster";
import NavTheme from "@/components/layout/NavTheme";
import { APP_DESCRIPTION, APP_NAME, APP_URL } from "@/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Mock Tests for CBSE & Assam Board`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    locale: "en_IN",
    type: "website",
    url: APP_URL,
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NavTheme>
          <ThemeProvider defaultTheme="system" enableSystem>
            {children}
            <Toaster />
          </ThemeProvider>
        </NavTheme>
        <Analytics />
      </body>
    </html>
  );
}
