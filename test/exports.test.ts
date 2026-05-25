import { describe, expect, it } from "vitest";
import * as lib from "../src/index";

const REQUIRED_EXPORTS = [
  "assembleStream",
  "assembleFromPayloads",
  "assembleResponse",
  "assembleFromFile",
  "parseSSE",
  "parsePartialJSON",
  "createAssemblyTransform",
  "collectStream",
  "toSSE",
  "tapEvents",
  "matchEvent",
  "openaiChatAdapter",
  "openaiCompatibleAdapter",
  "anthropicAdapter",
  "openaiResponsesAdapter",
] as const;

const TYPE_GUARD_EXPORTS = [
  "isTextDelta",
  "isTextDone",
  "isToolCallStart",
  "isToolCallDone",
  "isFinish",
  "isError",
] as const;

describe("exports.test.ts — public API surface", () => {
  it("exports all required functions", () => {
    for (const name of REQUIRED_EXPORTS) {
      expect(typeof lib[name]).toBe("function");
    }
  });

  it("exports at least five type guards", () => {
    for (const name of TYPE_GUARD_EXPORTS) {
      expect(typeof lib[name]).toBe("function");
    }
  });
});
