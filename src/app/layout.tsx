import type { Metadata } from "next";
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
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    locale: "en_IN",
    type: "website",
    url: APP_URL,
    images: [
      {
        url: "/favicon.svg",
        width: 512,
        height: 512,
        alt: `${APP_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/favicon.svg"],
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
      </body>
    </html>
  );
}
