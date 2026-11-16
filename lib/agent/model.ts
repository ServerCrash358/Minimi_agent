import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import type { LanguageModel } from "ai";

// MODEL="provider:model-id" picks the model at runtime; swapping providers is an env change.
//   anthropic:claude-sonnet-5-5 | openai:gpt-5 | google:gemini-3-flash-preview | bedrock:us.anthropic.claude-sonnet-5-5

export class ConfigError extends Error {}

type Provider = "anthropic" | "openai" | "google" | "bedrock";
const PROVIDERS: Provider[] = ["anthropic", "openai", "google", "bedrock"];

/** What each provider needs, as a human sentence (used in error messages) and a presence check. */
const NEEDS: Record<Provider, { text: string; present: () => boolean }> = {
  anthropic: { text: "ANTHROPIC_API_KEY", present: () => !!process.env.ANTHROPIC_API_KEY },
  openai: { text: "OPENAI_API_KEY", present: () => !!process.env.OPENAI_API_KEY },
  google: { text: "GOOGLE_GENERATIVE_AI_API_KEY", present: () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY },
  bedrock: {
    text: "AWS_BEARER_TOKEN_BEDROCK (a Bedrock API key), or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, plus AWS_REGION",
    present: () => !!process.env.AWS_BEARER_TOKEN_BEDROCK || (!!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY),
  },
};

// Used when MODEL is unset: first provider that has credentials. [main, cheap extraction model]
const DEFAULTS: Record<Provider, [string, string]> = {
  anthropic: ["claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-5", "gpt-5-mini"],
  // Measured on a free key: the *-latest aliases hung and gemini-3.5-flash took ~19s to say hi
  // (default "thinking"); gemini-3-flash-preview answers in ~2s and handled tool calls correctly.
  google: ["gemini-3-flash-preview", "gemini-3-flash-preview"],
  // "us." is a cross-region inference profile, which is how Bedrock serves current Claude models.
  bedrock: ["us.anthropic.claude-sonnet-5-5", "us.anthropic.claude-haiku-5-5"],
};

function parse(spec: string): { provider: Provider; id: string } {
  const i = spec.indexOf(":"); // first colon only: Bedrock ids can contain more (e.g. "...-v1:0")
  const provider = (i < 0 ? "" : spec.slice(0, i)).trim().toLowerCase();
  const id = (i < 0 ? "" : spec.slice(i + 1)).trim();
  if (!PROVIDERS.includes(provider as Provider) || !id) {
    throw new ConfigError(
      `MODEL must look like "anthropic:claude-sonnet-5-5", "openai:gpt-5", "google:gemini-3-flash-preview" or "bedrock:us.anthropic.claude-sonnet-5-5" (got "${spec}").`,
    );
  }
  return { provider: provider as Provider, id };
}

function defaultSpec(which: 0 | 1): string {
  for (const p of PROVIDERS) if (NEEDS[p].present()) return `${p}:${DEFAULTS[p][which]}`;
  throw new ConfigError(
    "No model credentials found. Set a key for one provider in .env.local (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or AWS credentials for Bedrock). See .env.example.",
  );
}

function build(spec: string): { model: LanguageModel; label: string } {
  const { provider, id } = parse(spec);
  if (!NEEDS[provider].present()) {
    throw new ConfigError(`MODEL is "${spec}" but ${NEEDS[provider].text} is not set (see .env.example).`);
  }
  let model: LanguageModel;
  switch (provider) {
    case "anthropic":
      model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id);
      break;
    case "openai":
      model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id);
      break;
    case "google":
      model = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(id);
      break;
    case "bedrock":
      // Credentials are read from the environment by the provider (bearer token, or SigV4 access keys).
      model = createAmazonBedrock({ region: process.env.AWS_REGION || "us-east-1" })(id);
      break;
  }
  return { model, label: `${provider}:${id}` };
}

/** The main answering model. Throws ConfigError with a message that names what is missing. */
export function mainModel() {
  return build(process.env.MODEL?.trim() || defaultSpec(0));
}

/** Small model for background extraction. Falls back to the main provider's small model if unset. */
export function extractionModel() {
  const spec = process.env.EXTRACT_MODEL?.trim();
  if (spec) return build(spec);
  const main = process.env.MODEL?.trim();
  if (main) {
    const { provider } = parse(main);
    return build(`${provider}:${DEFAULTS[provider][1]}`);
  }
  return build(defaultSpec(1));
}
