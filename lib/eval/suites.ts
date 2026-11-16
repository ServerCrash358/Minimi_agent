import { seedDemoHistory, type SeededConversation } from "../seed";
import { buildCases, type EvalCase, type EvalEnv } from "./cases";
import { buildHoldoutCases, seedHoldout } from "./holdout";

export type Suite = {
  id: "core" | "holdout";
  title: string;
  /** Seed the history the suite's cases refer to, for the user who has history. */
  seed: (userId: string, nowMs: number, tz: string) => SeededConversation[];
  build: (env: EvalEnv) => EvalCase[];
};

export const SUITES: Record<Suite["id"], Suite> = {
  core: {
    id: "core",
    title: "Core suite (the three sample questions and the cases written alongside them)",
    seed: (userId, nowMs, tz) => seedDemoHistory({ userId, nowMs, tz }),
    build: buildCases,
  },
  holdout: {
    id: "holdout",
    title: "Held-out suite (new questions of the same kinds, written after tuning)",
    seed: (userId, nowMs, tz) => seedHoldout(userId, nowMs, tz),
    build: buildHoldoutCases,
  },
};
