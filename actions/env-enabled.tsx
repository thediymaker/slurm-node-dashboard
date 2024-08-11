"use server";

export async function FeatureEnabled(feature: string) {
  if (process.env.feature === "" || process.env.feature === undefined) {
    return false;
  } else {
    return true;
  }
}
