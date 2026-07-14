import type { SheetEligibility, SourceProfile } from "./types";

export interface ProfileEligibilityDecision {
  eligibility: SheetEligibility;
  reason: string;
  shouldParse: boolean;
}

export function decideProfileEligibility(
  profile: SourceProfile,
  confidence: number,
): ProfileEligibilityDecision {
  if (profile === "HELP_OR_TEMPLATE_SKIP") {
    return {
      eligibility: "skipped",
      reason: "help, reference, form, or template sheet is not asset data",
      shouldParse: false,
    };
  }
  if (profile === "SUMMARY_SKIP") {
    return {
      eligibility: "skipped",
      reason: "summary sheet is not an exportable asset table",
      shouldParse: false,
    };
  }
  if (profile === "REVIEW_MAINTENANCE") {
    return {
      eligibility: "unsupported",
      reason: "maintenance sheet requires a dedicated conversion policy",
      shouldParse: false,
    };
  }
  if (profile === "UNKNOWN") {
    return {
      eligibility: "unsupported",
      reason: "unknown asset-like sheet requires manual review and is not exported by default",
      shouldParse: true,
    };
  }
  if (confidence < 0.55) {
    return {
      eligibility: "needsReview",
      reason: `profile confidence ${confidence} is below export threshold`,
      shouldParse: true,
    };
  }
  return {
    eligibility: "exportable",
    reason: "profile matched an exportable asset layout",
    shouldParse: true,
  };
}
