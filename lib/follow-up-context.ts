export interface FollowUpContextInput {
  userMessage: string;
  assistantText: string;
  toolContext?: string;
  toolGuidance?: string;
  toolNames: string[];
  hasToolOutput: boolean;
}
