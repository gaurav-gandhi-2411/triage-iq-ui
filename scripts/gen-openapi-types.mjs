// Regenerates src/api/schema.d.ts from the backend's live OpenAPI spec.
// Source of truth is the deployed API, not a checked-in copy of the spec (ADR-0001's
// deferred codegen mitigation for type drift between triage-iq and triage-iq-ui).
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const DEFAULT_SPEC_URL = "https://triageiq-api-242393598566.us-central1.run.app/openapi.json";
const specUrl = process.env.OPENAPI_URL ?? DEFAULT_SPEC_URL;
const outPath = fileURLToPath(new URL("../src/api/schema.d.ts", import.meta.url));

console.log(`Generating types from ${specUrl}`);
const ast = await openapiTS(new URL(specUrl));
const header = `${COMMENT_HEADER}// Source: ${specUrl}\n\n`;
await writeFile(outPath, header + astToString(ast));
console.log(`Wrote ${outPath}`);
