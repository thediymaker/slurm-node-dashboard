import { auth } from "@/auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import yaml from "js-yaml";
import { loadLLMConfig, invalidateCache } from "@/lib/llm-config";

const LLM_CONFIG_PATH =
  process.env.LLM_CONFIG_PATH || "infra/llm-assistant.yaml";

// GET — return the current config as JSON + raw YAML
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await fs.readFile(LLM_CONFIG_PATH, "utf-8");
    const config = await loadLLMConfig();
    return NextResponse.json({ config, raw });
  } catch {
    const config = await loadLLMConfig();
    return NextResponse.json({ config, raw: "" });
  }
}

// PUT — save updated config (accepts raw YAML or structured config JSON)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    let yamlContent: string;

    if (typeof body.raw === "string") {
      // Direct YAML editing mode
      yamlContent = body.raw;
    } else if (body.config) {
      // Structured config mode — convert to YAML
      yamlContent = yaml.dump(body.config, {
        lineWidth: 120,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
      });
    } else {
      return NextResponse.json(
        { error: "Request must include 'raw' (YAML string) or 'config' (object)" },
        { status: 400 }
      );
    }

    // Validate YAML before saving
    try {
      yaml.load(yamlContent);
    } catch (yamlErr) {
      return NextResponse.json(
        { error: `Invalid YAML: ${(yamlErr as Error).message}` },
        { status: 400 }
      );
    }

    await fs.writeFile(LLM_CONFIG_PATH, yamlContent, "utf-8");

    // Bust the in-memory cache so next request picks up changes immediately
    invalidateCache();

    const config = await loadLLMConfig();
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save config: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
