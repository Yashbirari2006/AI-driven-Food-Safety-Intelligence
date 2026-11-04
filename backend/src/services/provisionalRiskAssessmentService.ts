
import type { ComplaintTriageResult } from "./triageService";

export const PROVISIONAL_RISK_RULES_VERSION =
  "provisional-risk-rules-v1";

export type ProvisionalRiskAssessmentInput = {
  triage: ComplaintTriageResult;
  title: string;
  description: string;
  foodType: string;
  photoCount: number;
};

export type ProvisionalRiskAssessmentResult = {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  evidenceQuality: "INSUFFICIENT";
  status: "PROVISIONAL";
  humanReviewRequired: true;
  contributingFactors: {
    rulesVersion: string;
    scoreMeaning: string;
    signals: Array<{
      code: string;
      points: number;
      description: string;
    }>;
    limitations: string[];
  };
  evidenceSnapshot: {
    source: "CITIZEN_SUBMITTED_COMPLAINT";
    title: string;
    description: string;
    foodType: string;
    photoCount: number;
    reportedSignals: ComplaintTriageResult["inputSnapshot"]["reportedSignals"];
    triageRulesVersion: string;
    allegationsVerified: false;
  };
  modelVersions: {
    engine: "RULE_BASED";
    rulesVersion: string;
  };
};

const SIGNAL_RULES = [
  {
    key: "illnessMentioned",
    code: "REPORTED_ILLNESS",
    points: 25,
    description:
      "Possible illness or symptoms are mentioned in the complaint.",
  },
  {
    key: "multiplePeopleMentioned",
    code: "REPORTED_MULTIPLE_PEOPLE",
    points: 15,
    description:
      "The complaint refers to multiple potentially affected people.",
  },
  {
    key: "ongoingServiceMentioned",
    code: "REPORTED_ONGOING_SERVICE",
    points: 10,
    description:
      "The complaint suggests that food may still be served or sold.",
  },
  {
    key: "contaminationMentioned",
    code: "REPORTED_CONTAMINATION",
    points: 20,
    description:
      "Possible contamination or foreign material is reported.",
  },
  {
    key: "spoilageMentioned",
    code: "REPORTED_SPOILAGE",
    points: 10,
    description:
      "Possible food spoilage or expired food is reported.",
  },
  {
    key: "pestMentioned",
    code: "REPORTED_PEST_ACTIVITY",
    points: 10,
    description:
      "Possible pest activity is reported.",
  },
  {
    key: "hygieneMentioned",
    code: "REPORTED_HYGIENE_CONCERN",
    points: 5,
    description:
      "A possible hygiene concern is reported.",
  },
  {
    key: "storageConcernMentioned",
    code: "REPORTED_STORAGE_CONCERN",
    points: 5,
    description:
      "Possible unsafe food storage or temperature handling is reported.",
  },
] as const;

const LIMITATIONS = [
  "The score is an initial engineering heuristic, not a probability of harm.",
  "The scoring weights and thresholds have not been scientifically validated.",
  "Signals are extracted from citizen-submitted text and are not independently verified.",
  "Submitted photographs have not been inspected or authenticated by this assessment.",
  "A LOW result does not establish that food or an establishment is safe.",
  "Human officer review is required before any enforcement decision.",
];

export function evaluateProvisionalRiskAssessment(
  input: ProvisionalRiskAssessmentInput,
): ProvisionalRiskAssessmentResult {
  if (
    !Number.isSafeInteger(input.photoCount) ||
    input.photoCount < 0
  ) {
    throw new Error("photoCount must be a non-negative integer");
  }

  const reportedSignals = input.triage.inputSnapshot.reportedSignals;

  const signals = SIGNAL_RULES
    .filter((rule) => reportedSignals[rule.key])
    .map((rule) => ({
      code: rule.code,
      points: rule.points,
      description: rule.description,
    }));

  const riskScore = Math.min(
    100,
    signals.reduce((total, signal) => total + signal.points, 0),
  );

  let riskLevel: "LOW" | "MEDIUM" | "HIGH";

  if (riskScore >= 50) {
    riskLevel = "HIGH";
  } else if (riskScore >= 20) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  return {
    riskScore,
    riskLevel,
    evidenceQuality: "INSUFFICIENT",
    status: "PROVISIONAL",
    humanReviewRequired: true,

    contributingFactors: {
      rulesVersion: PROVISIONAL_RISK_RULES_VERSION,
      scoreMeaning:
        "A heuristic screening index based on reported text signals; it is not a probability or a verified food-safety risk measurement.",
      signals,
      limitations: LIMITATIONS,
    },

    evidenceSnapshot: {
      source: "CITIZEN_SUBMITTED_COMPLAINT",
      title: input.title.trim(),
      description: input.description.trim(),
      foodType: input.foodType.trim(),
      photoCount: input.photoCount,
      reportedSignals,
      triageRulesVersion: input.triage.inputSnapshot.rulesVersion,
      allegationsVerified: false,
    },

    modelVersions: {
      engine: "RULE_BASED",
      rulesVersion: PROVISIONAL_RISK_RULES_VERSION,
    },
  };
}
