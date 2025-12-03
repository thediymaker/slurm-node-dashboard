"use server";

import semver from "semver";
import packageJson from "@/package.json";

export async function checkUpdate() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/thediymaker/slurm-node-dashboard/releases/latest",
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      return { hasUpdate: false, latestVersion: packageJson.version, url: "" };
    }

    const data = await response.json();
    const latestVersion = data.tag_name.replace(/^v/, ""); // Remove 'v' prefix if present
    const currentVersion = packageJson.version;

    const coercedLatest = semver.coerce(latestVersion);
    const coercedCurrent = semver.coerce(currentVersion);

    if (coercedLatest && coercedCurrent && semver.gt(coercedLatest, coercedCurrent)) {
      return {
        hasUpdate: true,
        latestVersion,
        url: data.html_url,
      };
    }

    return { hasUpdate: false, latestVersion, url: data.html_url };
  } catch (error) {
    console.error("Failed to check for updates:", error);
    return { hasUpdate: false, latestVersion: packageJson.version, url: "" };
  }
}
