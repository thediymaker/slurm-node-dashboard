import { getSession } from "@/auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import yaml from "js-yaml";
import {
  LLM_CONFIG_PATH,
  LLM_LOCAL_CONFIG_PATH,
  buildLLMConfig,
  buildLLMConfigOverride,
  loadBaseLLMConfig,
  loadLLMConfig,
  loadLLMConfigSources,
  invalidateCache,
} from "@/lib/llm-config";

const BASE_CONFIG_DISPLAY_PATH = "infra/llm-assistant.yaml";
const LOCAL_CONFIG_DISPLAY_PATH = "infra/llm-assistant.local.yaml";

function buildConfigResponse(config: Awaited<ReturnType<typeof loadLLMConfig>>, raw: string, baseRaw: string) {
  return {
    config,
    raw,
    localRaw: raw,
    baseRaw,
    baseConfigPath: BASE_CONFIG_DISPLAY_PATH,
    localConfigPath: LOCAL_CONFIG_DISPLAY_PATH,
    saveTarget: "local-overrides",
    hasLocalOverride: raw.trim().length > 0,
  };
}

// GET — return the current config as JSON + raw YAML
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { base, local } = await loadLLMConfigSources();
    const config = await loadLLMConfig();
    return NextResponse.json(buildConfigResponse(config, local.raw, base.raw));
  } catch {
    const config = await loadLLMConfig();
    return NextResponse.json(buildConfigResponse(config, "", ""));
  }
}

// PUT — save updated config to the ignored local override file.
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const { base, local } = await loadLLMConfigSources();
    let yamlContent = "";

    if (typeof body.raw === "string") {
      yamlContent = body.raw;
    } else if (body.config) {
      const baseConfig = buildLLMConfig(base.parsed);
      const nextConfig = buildLLMConfig(body.config);
      const overrideConfig = buildLLMConfigOverride(baseConfig, nextConfig);

      if (Object.keys(overrideConfig).length > 0) {
        yamlContent = yaml.dump(overrideConfig, {
          lineWidth: 120,
          noRefs: true,
          quotingType: '"',
          forceQuotes: false,
        });
      }
    } else {
      return NextResponse.json(
        { error: "Request must include 'raw' (YAML string) or 'config' (object)" },
        { status: 400 }
      );
    }

    if (yamlContent.trim()) {
      try {
        yaml.load(yamlContent);
      } catch (yamlErr) {
        return NextResponse.json(
          { error: `Invalid YAML: ${(yamlErr as Error).message}` },
          { status: 400 }
        );
      }
    }

    if (yamlContent.trim()) {
      await fs.writeFile(LLM_LOCAL_CONFIG_PATH, yamlContent, "utf-8");
    } else if (local.exists) {
      await fs.rm(LLM_LOCAL_CONFIG_PATH, { force: true });
    }

    invalidateCache();

    const config = await loadLLMConfig();
    const nextLocalRaw = yamlContent.trim() ? yamlContent : "";

    return NextResponse.json({
      success: true,
      message: "Local overrides saved successfully.",
      ...buildConfigResponse(config, nextLocalRaw, base.raw),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save config: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
