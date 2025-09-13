import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doc Hub",
  description: "Document management and chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <Providers>
          <AuthenticatedLayout>
            {children}
          </AuthenticatedLayout>
        </Providers>
      </body>
    </html>
  );
}
