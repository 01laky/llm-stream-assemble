import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/index": "src/core/index.ts",
    "adapters/openai-chat": "src/adapters/openai-chat.ts",
    "adapters/openai-compatible": "src/adapters/openai-compatible.ts",
    "adapters/anthropic": "src/adapters/anthropic.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
  outDir: "dist",
});
