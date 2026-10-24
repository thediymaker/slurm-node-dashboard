import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { withBasePath } from "@/lib/base-path";

const env = process.env;

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${env.CLUSTER_NAME} Supercomputer`,
  description: "A Slurm supercomputer dashboard.",
  icons: {
    icon: withBasePath("/favicon.ico"),
    apple: [
      { url: withBasePath("/apple-icon.png") },
      { url: withBasePath("/apple-icon-180x180.png"), sizes: "180x180", type: "image/png" },
    ],
    shortcut: withBasePath("/favicon.ico"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
