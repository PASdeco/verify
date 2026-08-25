import type { Verdict } from "@/types/verification";

export const VERDICT_META: Record<
  Verdict,
  { icon: string; chip: string; headingPrefix: string; label: string }
> = {
  CONSISTENT: {
    icon: "\u2713",
    chip: "v-consistent-chip",
    headingPrefix: "Information",
    label: "Consistent",
  },
  SUSPICIOUS: {
    icon: "\u26A0",
    chip: "v-suspicious-chip",
    headingPrefix: "Information",
    label: "Suspicious",
  },
  INCONCLUSIVE: {
    icon: "?",
    chip: "v-inconclusive-chip",
    headingPrefix: "Verification",
    label: "Inconclusive",
  },
};

/** Investigation stages shown while the contract runs. */
export const INVESTIGATION_STAGES = [
  "Barcode identified",
  "Product lookup initiated",
  "Comparing available evidence",
  "Validators evaluating information",
  "Reaching consensus",
] as const;
