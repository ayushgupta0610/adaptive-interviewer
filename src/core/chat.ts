/** Provider-neutral chat message shape (OpenAI/OpenRouter-compatible). */
export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}
