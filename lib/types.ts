import type { UIMessage } from "ai";

// Shared by server and client (no node-only imports here).

export type SourceData = {
  n: number;
  url: string;
  title: string;
  publishedAt: string | null;
};

export type SearchToolInput = { query: string; site?: string; since?: string };

export type SearchToolOutput =
  | {
      query: string;
      cached: boolean;
      /** Present when page text addressed to AI assistants was removed. */
      notice?: string;
      results: Array<{ n: number; cite: string; title: string; url: string; date: string | null; excerpt: string }>;
    }
  | { query: string; error: string; results: [] };

export type ChatMessage = UIMessage<
  { createdAt?: number },
  { source: SourceData },
  { web_search: { input: SearchToolInput; output: SearchToolOutput } }
>;

/** Body the browser sends to /api/chat. The server owns history; the client sends only the new turn. */
export type ChatRequest = { threadId: string; text: string; tz: string };
