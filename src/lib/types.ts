import type { components } from "./api-schema";

// Single source of truth for API response shapes, derived from the generated OpenAPI schema
// (`npm run codegen:types`, ADR-0001's deferred codegen) instead of hand-copied per-component
// interfaces. Closes the type-drift risk of two independent hand-written copies of
// SimilarIssue/GroundingStatus (App.tsx, UnderTheHood.tsx) silently diverging from each other
// or from what the backend actually returns.
export type SimilarIssue = components["schemas"]["SimilarIssue"];
export type GroundingAttribution = components["schemas"]["GroundingAttribution"];
export type GroundingStatus = components["schemas"]["GroundingStatus"];
export type ConformalIntervalResult = components["schemas"]["ConformalIntervalResult"];

// TriagePlan extended with fields the API actually returns but that aren't declared on
// FastAPI's response_model (so openapi-typescript can't see them) -- added post-serialization
// by the endpoint, not part of the documented schema. Keep this list in sync manually; a field
// removed here without being removed from the actual response is caught by TypeScript at every
// call site that reads it (better than the previous fully-hand-written interface, which caught
// nothing).
export type TriagePlan = components["schemas"]["TriagePlan"] & {
  _request_id: string;
  _llm_status: string;
  _llm_cache_hit?: boolean | null;
  classifier_top3?: Array<{ label: string; confidence: number }>;
  resolution_model_beats_naive?: boolean;
};
