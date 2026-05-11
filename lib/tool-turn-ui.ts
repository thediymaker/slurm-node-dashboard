export type ToolTurnDetailTone =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface ToolTurnDetailItem {
  label: string;
  value: string;
  tone?: ToolTurnDetailTone;
  code?: boolean;
}

export interface ToolTurnDetails {
  title?: string;
  intro?: string;
  items?: ToolTurnDetailItem[];
  notes?: string[];
}

export interface ToolTurnUI {
  toolId?: string;
  toolName?: string;
  category?: string;
  details?: ToolTurnDetails;
  followUpContext?: string;
  promptGuidance?: string;
}

export interface ToolTurnOutput {
  _toolUi?: ToolTurnUI;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getToolTurnUI(value: unknown): ToolTurnUI | undefined {
  if (!isObjectRecord(value) || !isObjectRecord(value._toolUi)) {
    return undefined;
  }

  const rawToolUi = value._toolUi;
  return {
    toolId: getString(rawToolUi.toolId),
    toolName: getString(rawToolUi.toolName),
    category: getString(rawToolUi.category),
    details: isObjectRecord(rawToolUi.details)
      ? {
          title:
            typeof rawToolUi.details.title === "string"
              ? rawToolUi.details.title
              : undefined,
          intro:
            typeof rawToolUi.details.intro === "string"
              ? rawToolUi.details.intro
              : undefined,
          items: Array.isArray(rawToolUi.details.items)
            ? rawToolUi.details.items.filter(isToolTurnDetailItem)
            : undefined,
          notes: Array.isArray(rawToolUi.details.notes)
            ? rawToolUi.details.notes.filter(
                (note): note is string => typeof note === "string"
              )
            : undefined,
        }
      : undefined,
    followUpContext:
      typeof rawToolUi.followUpContext === "string"
        ? rawToolUi.followUpContext
        : undefined,
    promptGuidance:
      typeof rawToolUi.promptGuidance === "string"
        ? rawToolUi.promptGuidance
        : undefined,
  };
}

export function attachToolTurnUI<T>(
  result: T,
  toolUi?: ToolTurnUI
): T & ToolTurnOutput {
  if (!toolUi) {
    return result as T & ToolTurnOutput;
  }

  if (isObjectRecord(result)) {
    return {
      ...result,
      _toolUi: toolUi,
    } as T & ToolTurnOutput;
  }

  return {
    value: result,
    _toolUi: toolUi,
  } as unknown as T & ToolTurnOutput;
}

function isToolTurnDetailItem(value: unknown): value is ToolTurnDetailItem {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.label === "string" &&
    typeof value.value === "string" &&
    (value.tone === undefined ||
      value.tone === "default" ||
      value.tone === "info" ||
      value.tone === "success" ||
      value.tone === "warning" ||
      value.tone === "danger") &&
    (value.code === undefined || typeof value.code === "boolean")
  );
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
