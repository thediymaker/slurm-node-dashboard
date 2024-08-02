import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { env } from "process";
import { AI } from "@/actions/actions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${env.CLUSTER_NAME} Supercomputer`,
  description: "A Slurm supercomputer dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <AI>
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </AI>
    </html>
  );
}
