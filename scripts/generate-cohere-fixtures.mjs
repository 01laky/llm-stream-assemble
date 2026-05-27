import {
	writeExpectedFromJsonl,
	writeExpectedFromResponse,
	jsonlToSse,
} from "../test/helpers/cohere-fixtures.ts";

const jsonlFixtures = [
	"text-basic",
	"text-unicode",
	"text-empty",
	"tool-single",
	"tool-parallel",
	"tool-partial-input",
	"tool-no-plan",
	"tool-late-id",
	"json-mode",
	"response-format-json",
	"tool-plan",
	"citations-stream",
	"citations-interleaved",
	"provider-error",
	"usage-only",
	"incomplete",
];

const jsonModeFixtures = new Set(["json-mode", "response-format-json"]);

const responseFixtures = [
	"response-text",
	"response-tool",
	"response-error",
	"response-format-json",
	"response-citations",
];

const sseFixtures = ["text-basic", "tool-single"];

for (const name of jsonlFixtures) {
	await writeExpectedFromJsonl(name, jsonModeFixtures.has(name));
	console.log(`expected ${name}.jsonl`);
}

for (const name of responseFixtures) {
	const jsonMode = name === "response-format-json";
	await writeExpectedFromResponse(name, jsonMode);
	console.log(`expected ${name}.json`);
}

for (const name of sseFixtures) {
	jsonlToSse(name);
	console.log(`sse ${name}.sse`);
}

console.log("done");
