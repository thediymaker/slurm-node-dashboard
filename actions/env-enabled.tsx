"use server";

export async function FeatureEnabled(feature: string): Promise<boolean> {
  const envValue = process.env[feature];
  return envValue !== "" && envValue !== undefined;
}
