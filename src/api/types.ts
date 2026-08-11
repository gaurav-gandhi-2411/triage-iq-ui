import type { components } from "./schema";

export type SimilarIssue = components["schemas"]["SimilarIssue"];
export type GroundingAttribution = components["schemas"]["GroundingAttribution"];
export type GroundingStatus = components["schemas"]["GroundingStatus"];
export type ConformalIntervalResult = components["schemas"]["ConformalIntervalResult"];

// `/triage`'s handler returns JSONResponse(plan.model_dump() | extra fields) directly
// (src/triage_iq/api/app.py:386-392 in triage-iq), bypassing FastAPI's response_model
// serialization -- these 5 fields are real, always present in the live response, but
// not declared on the response_model, so openapi-typescript can't see them. Extended
// here by hand until the backend schema is corrected to declare them.
export type TriagePlan = components["schemas"]["TriagePlan"] & {
  _request_id: string;
  _llm_status: string;
  _llm_cache_hit?: boolean | null;
  classifier_top3?: Array<{ label: string; confidence: number }> | null;
  resolution_model_beats_naive?: boolean;
};
