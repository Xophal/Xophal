import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/shared/toaster";
import NavTheme from "@/components/layout/NavTheme";
import PublicChrome from "@/components/layout/PublicChrome";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { APP_DESCRIPTION, APP_NAME, APP_URL } from "@/constants";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

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
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Xophol exam preparation for CBSE and Assam Board students" }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B4CC2",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased`}>
        <NavTheme>
          <ThemeProvider defaultTheme="system" enableSystem>
            <PublicChrome header={<Navbar />} footer={<Footer />}>
              {children}
            </PublicChrome>
            <Toaster />
          </ThemeProvider>
        </NavTheme>
      </body>
    </html>
  );
}
