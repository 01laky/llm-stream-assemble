import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), "llm-stream-assemble-smoke-"));

try {
	execFileSync("npm", ["pack", "--pack-destination", temp], { cwd: root, stdio: "pipe" });
	const tarball = readdirSync(temp).find((file) => file.endsWith(".tgz"));
	if (!tarball) throw new Error("npm pack did not produce a tarball");

	writeFileSync(
		join(temp, "package.json"),
		JSON.stringify({ type: "module", dependencies: {} }, null, 2),
	);

	execFileSync("npm", ["install", "--ignore-scripts", join(temp, tarball)], {
		cwd: temp,
		stdio: "pipe",
	});

	writeFileSync(
		join(temp, "esm.mjs"),
		`
import * as root from "llm-stream-assemble";
import * as core from "llm-stream-assemble/core";
import { openaiChatAdapter } from "llm-stream-assemble/adapters/openai-chat";
import { openaiCompatibleAdapter } from "llm-stream-assemble/adapters/openai-compatible";
import { anthropicAdapter } from "llm-stream-assemble/adapters/anthropic";
import { openaiResponsesAdapter } from "llm-stream-assemble/adapters/openai-responses";
import { geminiAdapter } from "llm-stream-assemble/adapters/gemini";

if (typeof root.assembleStream !== "function") throw new Error("root ESM import failed");
if (typeof core.assembleStream !== "function") throw new Error("core ESM import failed");
if (typeof openaiChatAdapter !== "function") throw new Error("openai-chat ESM import failed");
if (typeof openaiCompatibleAdapter !== "function") throw new Error("openai-compatible ESM import failed");
if (typeof anthropicAdapter !== "function") throw new Error("anthropic ESM import failed");
if (typeof openaiResponsesAdapter !== "function") throw new Error("openai-responses ESM import failed");
if (typeof geminiAdapter !== "function") throw new Error("gemini ESM import failed");
`,
	);

	writeFileSync(
		join(temp, "cjs.cjs"),
		`
const root = require("llm-stream-assemble");
const core = require("llm-stream-assemble/core");
const { openaiChatAdapter } = require("llm-stream-assemble/adapters/openai-chat");
const { openaiCompatibleAdapter } = require("llm-stream-assemble/adapters/openai-compatible");
const { anthropicAdapter } = require("llm-stream-assemble/adapters/anthropic");
const { openaiResponsesAdapter } = require("llm-stream-assemble/adapters/openai-responses");
const { geminiAdapter } = require("llm-stream-assemble/adapters/gemini");

if (typeof root.assembleStream !== "function") throw new Error("root CJS import failed");
if (typeof core.assembleStream !== "function") throw new Error("core CJS import failed");
if (typeof openaiChatAdapter !== "function") throw new Error("openai-chat CJS import failed");
if (typeof openaiCompatibleAdapter !== "function") throw new Error("openai-compatible CJS import failed");
if (typeof anthropicAdapter !== "function") throw new Error("anthropic CJS import failed");
if (typeof openaiResponsesAdapter !== "function") throw new Error("openai-responses CJS import failed");
if (typeof geminiAdapter !== "function") throw new Error("gemini CJS import failed");
`,
	);

	execFileSync("node", ["esm.mjs"], { cwd: temp, stdio: "pipe" });
	execFileSync("node", ["cjs.cjs"], { cwd: temp, stdio: "pipe" });
	console.log("OK: package smoke test passed");
} finally {
	rmSync(temp, { recursive: true, force: true });
}
