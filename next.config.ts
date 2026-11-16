import type { NextConfig } from "next";

const config: NextConfig = {
  // Native module: must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default config;
