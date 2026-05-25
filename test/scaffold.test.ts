import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import {
  assembleStream,
  isTextDelta,
  matchEvent,
  openaiChatAdapter,
  type StreamEvent,
} from "../src/index";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

beforeAll(() => {
  if (!existsSync(join(rootDir, "dist/index.d.ts"))) {
    execSync("npx pnpm@9 build", { cwd: rootDir, stdio: "pipe" });
  }
});

async function* emptyAsyncIterable<T>(): AsyncIterable<T> {
  // no yields
}

describe("LSA-S01: zero runtime dependencies", () => {
  it("package.json has no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });
});

describe("LSA-S02: build output", () => {
  it("dist/index.d.ts exists after build", () => {
    expect(existsSync(join(rootDir, "dist/index.d.ts"))).toBe(true);
  });
});

describe("LSA-S03: assembleStream export", () => {
  it("is a function", () => {
    expect(typeof assembleStream).toBe("function");
  });
});

describe("LSA-S04: openaiChatAdapter export", () => {
  it("is a function", () => {
    expect(typeof openaiChatAdapter).toBe("function");
  });
});

describe("LSA-S05: StreamEvent type", () => {
  it("accepts a text.delta event", () => {
    const event: StreamEvent = { type: "text.delta", text: "hi" };
    expect(event.type).toBe("text.delta");
  });
});

describe("LSA-S06: assembleStream stub", () => {
  it("throws not implemented when iterated", async () => {
    const stream = assembleStream(emptyAsyncIterable<string>(), openaiChatAdapter());
    await expect(async () => {
      for await (const _event of stream) {
        void _event;
      }
    }).rejects.toThrow(/not implemented yet/i);
  });
});

describe("LSA-S07: isTextDelta", () => {
  it("returns true for text.delta events", () => {
    expect(isTextDelta({ type: "text.delta", text: "hi" })).toBe(true);
  });
});

describe("LSA-S08: matchEvent", () => {
  it("calls the text.delta handler", () => {
    let text = "";
    matchEvent(
      { type: "text.delta", text: "hello" },
      {
        "text.delta": (event) => {
          text = event.text;
        },
      },
    );
    expect(text).toBe("hello");
  });
});

describe("LSA-S09: subpath export core", () => {
  it("resolves llm-stream-assemble/core from dist", async () => {
    const corePath = join(rootDir, "dist/core/index.js");
    const core = (await import(corePath)) as { assembleStream: unknown };
    expect(typeof core.assembleStream).toBe("function");
  });
});

describe("LSA-S10: verify-zero-deps script", () => {
  it("exits 0", () => {
    expect(() => {
      execSync("node scripts/verify-zero-deps.mjs", { cwd: rootDir, stdio: "pipe" });
    }).not.toThrow();
  });
});
