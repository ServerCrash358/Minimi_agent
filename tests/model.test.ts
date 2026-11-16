import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, extractionModel, mainModel } from "../lib/agent/model";

const VARS = [
  "MODEL", "EXTRACT_MODEL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY",
  "AWS_BEARER_TOKEN_BEDROCK", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION",
];

function withEnv(env: Record<string, string>, fn: () => void) {
  const saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
  for (const v of VARS) delete process.env[v];
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  }
}

test("Bedrock: model ids keep their own colons, and a bearer token is enough", () => {
  withEnv({ MODEL: "bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0", AWS_BEARER_TOKEN_BEDROCK: "t" }, () => {
    assert.equal(mainModel().label, "bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0");
  });
});

test("Bedrock: access keys also work; a key id without the secret does not", () => {
  withEnv({ MODEL: "bedrock:us.anthropic.claude-sonnet-5-5", AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "b" }, () => {
    assert.equal(mainModel().label, "bedrock:us.anthropic.claude-sonnet-5-5");
  });
  withEnv({ MODEL: "bedrock:us.anthropic.claude-sonnet-5-5", AWS_ACCESS_KEY_ID: "a" }, () => {
    assert.throws(() => mainModel(), (e: Error) => e instanceof ConfigError && /AWS_BEARER_TOKEN_BEDROCK/.test(e.message));
  });
});

test("with MODEL unset, the first provider that has credentials wins, and extraction uses its small model", () => {
  withEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "g", AWS_BEARER_TOKEN_BEDROCK: "t" }, () => {
    assert.equal(mainModel().label, "google:gemini-3-flash-preview");
  });
  withEnv({ AWS_BEARER_TOKEN_BEDROCK: "t" }, () => {
    assert.equal(mainModel().label, "bedrock:us.anthropic.claude-sonnet-5-5");
    assert.equal(extractionModel().label, "bedrock:us.anthropic.claude-haiku-5-5");
  });
});

test("extraction follows MODEL's provider, and EXTRACT_MODEL overrides it", () => {
  withEnv({ MODEL: "bedrock:us.anthropic.claude-sonnet-5-5", AWS_BEARER_TOKEN_BEDROCK: "t" }, () => {
    assert.equal(extractionModel().label, "bedrock:us.anthropic.claude-haiku-5-5");
  });
  withEnv({ MODEL: "bedrock:us.anthropic.claude-sonnet-5-5", EXTRACT_MODEL: "google:gemini-3-flash-preview", AWS_BEARER_TOKEN_BEDROCK: "t", GOOGLE_GENERATIVE_AI_API_KEY: "g" }, () => {
    assert.equal(extractionModel().label, "google:gemini-3-flash-preview");
  });
});

test("clear errors: nothing configured, unknown provider, missing key", () => {
  withEnv({}, () => assert.throws(() => mainModel(), /No model credentials found/));
  withEnv({ MODEL: "mistral:large" }, () => assert.throws(() => mainModel(), /MODEL must look like/));
  withEnv({ MODEL: "anthropic" }, () => assert.throws(() => mainModel(), /MODEL must look like/));
  withEnv({ MODEL: "anthropic:claude-sonnet-5-5" }, () => assert.throws(() => mainModel(), /ANTHROPIC_API_KEY is not set/));
});
