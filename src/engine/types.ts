export type FieldKey =
  | "employer_name"
  | "carrier"
  | "plan_name"
  | "plan_type"
  | "effective_date"
  | "renewal_date"
  | "deductible_individual"
  | "deductible_family"
  | "oop_max_individual"
  | "oop_max_family"
  | "coinsurance_pct"
  | "pcp_copay"
  | "specialist_copay"
  | "er_copay"
  | "waiting_period_days"
  | "eligibility_hours_per_week"
  | "employer_contribution_pct"
  | "hsa_eligible";

export type FieldValue = string | number | boolean;

export interface Evidence {
  /** 1-based page number (PDF page, or form-feed separated page for text input) */
  page: number;
  /** 1-based index of the non-empty line within its page */
  page_line: number;
  /** 0-based index into Extraction.lines */
  line: number;
  /** Exact matched span, copied character-for-character from the submitted source */
  quote: string;
  /** Offsets of quote within snippet: snippet.slice(start, end) === quote */
  start: number;
  end: number;
  /** Verbatim source line containing the quote (outer whitespace trimmed) */
  snippet: string;
  /** Value this particular span supports; differs across evidence when the field conflicts */
  value: FieldValue;
  /** True when quote was re-located at the stated page and offsets in the original input */
  verified: boolean;
}

export interface SourceLine {
  page: number;
  page_line: number;
  text: string;
}

export interface ExtractedField {
  key: FieldKey;
  value: FieldValue | null;
  /** 0..1; deterministic extractor assigns fixed confidences per pattern */
  confidence: number;
  evidence: Evidence[];
  /** Set when the document states the same field with different values */
  conflicts?: FieldValue[];
  source: "rules" | "ai" | "merged";
}

export type Severity = "error" | "warning" | "info";

export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  fields: FieldKey[];
  /** What the reviewer should do */
  action: string;
}

export interface Extraction {
  fields: Record<FieldKey, ExtractedField>;
  lineCount: number;
  pages: number;
  lines: SourceLine[];
}

export interface AnalysisResult {
  extraction: Extraction;
  findings: Finding[];
  summary: {
    required_present: number;
    required_total: number;
    errors: number;
    warnings: number;
    /** "ready" | "needs_review" | "blocked" */
    disposition: "ready" | "needs_review" | "blocked";
  };
  meta: {
    mode: "rules" | "rules+ai";
    ai_note?: string;
    ms: number;
  };
}

export const FIELD_KEYS: FieldKey[] = [
  "employer_name",
  "carrier",
  "plan_name",
  "plan_type",
  "effective_date",
  "renewal_date",
  "deductible_individual",
  "deductible_family",
  "oop_max_individual",
  "oop_max_family",
  "coinsurance_pct",
  "pcp_copay",
  "specialist_copay",
  "er_copay",
  "waiting_period_days",
  "eligibility_hours_per_week",
  "employer_contribution_pct",
  "hsa_eligible",
];

export const REQUIRED_FIELDS: FieldKey[] = [
  "employer_name",
  "carrier",
  "plan_name",
  "plan_type",
  "effective_date",
  "deductible_individual",
  "deductible_family",
  "oop_max_individual",
  "oop_max_family",
  "coinsurance_pct",
  "waiting_period_days",
  "employer_contribution_pct",
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  employer_name: "Employer",
  carrier: "Carrier",
  plan_name: "Plan name",
  plan_type: "Plan type",
  effective_date: "Effective date",
  renewal_date: "Renewal date",
  deductible_individual: "Deductible (individual)",
  deductible_family: "Deductible (family)",
  oop_max_individual: "Out-of-pocket max (individual)",
  oop_max_family: "Out-of-pocket max (family)",
  coinsurance_pct: "Coinsurance (member %)",
  pcp_copay: "PCP copay",
  specialist_copay: "Specialist copay",
  er_copay: "ER copay",
  waiting_period_days: "Waiting period (days)",
  eligibility_hours_per_week: "Eligibility (hours/week)",
  employer_contribution_pct: "Employer contribution (%)",
  hsa_eligible: "HSA eligible",
};
