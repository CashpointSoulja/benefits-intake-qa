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
  /** 0-based line index in the normalized source text */
  line: number;
  /** Verbatim source line */
  snippet: string;
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
