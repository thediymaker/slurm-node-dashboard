import { getSession } from "@/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  details: z.string().max(5000).optional().default(""),
  messages: z.array(z.unknown()).min(1).max(100),
  pageUrl: z.string().max(2000).optional(),
  userAgent: z.string().max(1000).optional(),
});

const MAX_SLACK_BLOCK_TEXT = 2800;
const MAX_TRANSCRIPT_CHUNKS = 20;

interface SlackBlock {
  type: string;
  text?: {
    type: "plain_text" | "mrkdwn";
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: "mrkdwn";
    text: string;
  }>;
  elements?: Array<{
    type: "mrkdwn";
    text: string;
  }>;
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Feedback requests must come from this dashboard." },
        { status: 403 }
      );
    }

    const body = feedbackSchema.parse(await request.json());
    const webhookUrl =
      process.env.SLACK_FEEDBACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          error:
            "No Slack feedback webhook configured. Set SLACK_FEEDBACK_WEBHOOK_URL or SLACK_WEBHOOK_URL.",
        },
        { status: 500 }
      );
    }

    const session = await getOptionalSession();
    const transcript = formatTranscript(body.messages);
    const transcriptChunks = chunkText(transcript, MAX_SLACK_BLOCK_TEXT).slice(
      0,
      MAX_TRANSCRIPT_CHUNKS
    );
    const wasTruncated =
      chunkText(transcript, MAX_SLACK_BLOCK_TEXT).length > MAX_TRANSCRIPT_CHUNKS;

    const firstMessage: SlackMessage = {
      text: `Slurm Assistant feedback: ${body.rating}/5`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Slurm Assistant Feedback",
            emoji: false,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Rating:*\n${"★".repeat(body.rating)}${"☆".repeat(5 - body.rating)} (${body.rating}/5)`,
            },
            {
              type: "mrkdwn",
              text: `*Messages:*\n${body.messages.length}`,
            },
            {
              type: "mrkdwn",
              text: `*User:*\n${formatSessionUser(session)}`,
            },
            {
              type: "mrkdwn",
              text: `*Page:*\n${escapeSlack(body.pageUrl || "Unknown")}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Feedback:*\n${escapeSlack(body.details.trim() || "No written feedback provided.")}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Submitted ${new Date().toISOString()}${body.userAgent ? ` • ${escapeSlack(body.userAgent)}` : ""}`,
            },
          ],
        },
      ],
    };

    const firstSent = await sendSlackNotification(webhookUrl, firstMessage);
    if (!firstSent) {
      return NextResponse.json(
        { error: "Failed to send feedback to Slack." },
        { status: 502 }
      );
    }

    for (const [index, chunk] of transcriptChunks.entries()) {
      const sent = await sendSlackNotification(webhookUrl, {
        text: `Slurm Assistant feedback transcript ${index + 1}/${transcriptChunks.length}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Transcript ${index + 1}/${transcriptChunks.length}:*\n\`\`\`${escapeSlack(chunk)}\`\`\``,
            },
          },
        ],
      });

      if (!sent) {
        return NextResponse.json(
          { error: "Feedback summary was sent, but transcript upload failed." },
          { status: 502 }
        );
      }
    }

    if (wasTruncated) {
      await sendSlackNotification(webhookUrl, {
        text: "Slurm Assistant feedback transcript was truncated",
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Transcript exceeded Slack payload limits and was truncated. Consider enabling database storage for full retention.",
              },
            ],
          },
        ],
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid feedback payload." },
        { status: 400 }
      );
    }

    console.error("Failed to submit chat feedback:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

async function getOptionalSession() {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage
) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (err) {
    console.error("Failed to send Slack feedback:", err);
    return false;
  }
}

function formatSessionUser(session: Awaited<ReturnType<typeof getOptionalSession>>) {
  const user = session?.user;
  const name = typeof user?.name === "string" ? user.name : "";
  const email = typeof user?.email === "string" ? user.email : "";

  if (name && email) return escapeSlack(`${name} <${email}>`);
  if (email) return escapeSlack(email);
  if (name) return escapeSlack(name);
  return "Anonymous or unauthenticated";
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function formatTranscript(messages: unknown[]) {
  return messages
    .map((message, index) => formatMessage(message, index + 1))
    .join("\n\n");
}

function formatMessage(message: unknown, index: number) {
  const record = asRecord(message);
  const role = getString(record?.role, "unknown").toUpperCase();
  const id = getString(record?.id);
  const parts = Array.isArray(record?.parts) ? record.parts : [];
  const formattedParts =
    parts.length > 0
      ? parts.map(formatPart).filter(Boolean).join("\n")
      : JSON.stringify(message, null, 2);

  return [`[${index}] ${role}${id ? ` (${id})` : ""}`, formattedParts].join(
    "\n"
  );
}

function formatPart(part: unknown) {
  const record = asRecord(part);
  if (!record) return "";

  if (record.type === "text") {
    return getString(record.text);
  }

  if (typeof record.type === "string" && record.type.startsWith("tool-")) {
    const toolName =
      getString(record.toolName) || record.type.replace(/^tool-/, "");
    const state = getString(record.state, "unknown");
    const output =
      "output" in record
        ? `\n${JSON.stringify(sanitizeToolOutput(record.output), null, 2)}`
        : "";

    return `[tool:${toolName}] state=${state}${output}`;
  }

  return JSON.stringify(part, null, 2);
}

function sanitizeToolOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeToolOutput);
  }

  const record = asRecord(value);
  if (!record) return value;

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== "_toolUi")
      .map(([key, entry]) => [key, sanitizeToolOutput(entry)])
  );
}

function chunkText(value: string, chunkSize: number) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }

  return chunks.length > 0 ? chunks : [""];
}

function escapeSlack(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
