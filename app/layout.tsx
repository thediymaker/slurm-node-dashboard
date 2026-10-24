import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { RuntimeConfigProvider } from "@/components/runtime-config";
import { withBasePath } from "@/lib/base-path";
import { getPublicConfig } from "@/lib/config";
import { getFeatures, toClientFeatures } from "@/lib/features";
import { getRandomGeekName } from "@/lib/utils";
import AppHeader from "@/components/app-header";
import { AssistantProvider } from "@/components/assistant";
import { getSession, isAdminLoginConfigured } from "@/auth";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return {
    title: `${getPublicConfig().clusterName} Supercomputer`,
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
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request so settings come from the server's environment, not
  // from whatever was set when the image was built
  await connection();
  const runtimeConfig = { ...getPublicConfig(), features: toClientFeatures(await getFeatures()) };
  const username = (await cookies()).get("SSONAME")?.value || getRandomGeekName();
  const admin = {
    signedIn: !!(await getSession().catch(() => null)),
    canSignIn: isAdminLoginConfigured(),
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <RuntimeConfigProvider value={runtimeConfig}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AssistantProvider>
              <AppHeader username={username} admin={admin} />
              {children}
            </AssistantProvider>
            <Toaster />
          </ThemeProvider>
        </RuntimeConfigProvider>
      </body>
    </html>
  );
}
