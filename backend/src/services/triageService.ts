export type TriageUrgency = "URGENT" | "HIGH" | "NORMAL";

export type TriageActionability =
  | "ACTIONABLE"
  | "NEEDS_INFORMATION"
  | "REVIEW_REQUIRED";

export type ComplaintTriageInput = {
  title: string;
  description: string;
  foodType: string;
  photoCount: number;
};

export type TriageReason = {
  code: string;
  description: string;
};

export type ComplaintTriageResult = {
  urgency: TriageUrgency;
  actionability: TriageActionability;
  reasons: TriageReason[];
  inputSnapshot: {
    rulesVersion: string;
    foodType: string;
    descriptionLength: number;
    photoCount: number;
    reportedSignals: {
      illnessMentioned: boolean;
      multiplePeopleMentioned: boolean;
      ongoingServiceMentioned: boolean;
      contaminationMentioned: boolean;
      spoilageMentioned: boolean;
      pestMentioned: boolean;
      hygieneMentioned: boolean;
      storageConcernMentioned: boolean;
    };
  };
};

const RULES_VERSION = "triage-rules-v1";

const patterns = {
  illness:
    /\b(vomit(?:ing)?|diarrh(?:ea|oea)|food poisoning|foodborne|stomach pain|stomach ache|food infection|sick after eating|fell ill|illness|hospitali[sz]ed)\b/i,

  multiplePeople:
  /\b(many people|multiple people|several people|many students|multiple students|several students|many customers|multiple customers|several customers|other customers|several children|multiple children|people affected|students affected|children affected|more than one person|group of people|several individuals|multiple individuals)\b/i,
  ongoingService:
    /\b(still serving|still selling|currently serving|currently selling|being served|being sold|continues to serve|continues selling|open and serving|food is still available)\b/i,

  contamination:
    /\b(foreign object|foreign material|insect in food|worm in food|hair in food|glass in food|metal piece|plastic piece|contaminat(?:ed|ion)|adulterat(?:ed|ion))\b/i,

  spoilage:
    /\b(rotten|spoiled|spoilt|decomposed|bad smell|foul smell|mould|mold|stale food|expired food)\b/i,

  pest:
    /\b(rat|rats|rodent|cockroach|cockroaches|flies|maggots|pest infestation)\b/i,

  hygiene:
    /\b(unclean|dirty kitchen|poor hygiene|unhygienic|unclean utensils|dirty utensils|unsafe handling|open drain)\b/i,

  storage:
    /\b(improper storage|unsafe storage|unrefrigerated|without refrigeration|temperature abuse|improper temperature|food left outside)\b/i,
};

export function evaluateComplaintTriage(
  input: ComplaintTriageInput,
): ComplaintTriageResult {
  const title = input.title.trim();
  const description = input.description.trim();
  const foodType = input.foodType.trim();
  const text = `${title} ${description}`;

  const reportedSignals = {
    illnessMentioned: patterns.illness.test(text),
    multiplePeopleMentioned: patterns.multiplePeople.test(text),
    ongoingServiceMentioned: patterns.ongoingService.test(text),
    contaminationMentioned: patterns.contamination.test(text),
    spoilageMentioned: patterns.spoilage.test(text),
    pestMentioned: patterns.pest.test(text),
    hygieneMentioned: patterns.hygiene.test(text),
    storageConcernMentioned: patterns.storage.test(text),
  };

  const reasons: TriageReason[] = [];

  if (reportedSignals.illnessMentioned) {
    reasons.push({
      code: "REPORTED_ILLNESS",
      description:
        "The complaint text mentions possible illness or symptoms. This report has not been medically or independently verified.",
    });
  }

  if (reportedSignals.multiplePeopleMentioned) {
    reasons.push({
      code: "REPORTED_MULTIPLE_PEOPLE",
      description:
        "The complaint text refers to multiple potentially affected people. The number and circumstances are unverified.",
    });
  }

  if (reportedSignals.ongoingServiceMentioned) {
    reasons.push({
      code: "REPORTED_ONGOING_SERVICE",
      description:
        "The complaint text suggests food may still be served or sold. Current availability requires officer verification.",
    });
  }

  if (reportedSignals.contaminationMentioned) {
    reasons.push({
      code: "REPORTED_CONTAMINATION",
      description:
        "The complaint text mentions possible foreign material, contamination or adulteration. This is an allegation, not a confirmed finding.",
    });
  }

  if (reportedSignals.spoilageMentioned) {
    reasons.push({
      code: "REPORTED_SPOILAGE",
      description:
        "The complaint text mentions possible spoilage, expired food or unusual odour. The condition requires verification.",
    });
  }

  if (reportedSignals.pestMentioned) {
    reasons.push({
      code: "REPORTED_PEST_ACTIVITY",
      description:
        "The complaint text mentions possible pest activity. The reported condition requires inspection.",
    });
  }

  if (reportedSignals.hygieneMentioned) {
    reasons.push({
      code: "REPORTED_HYGIENE_CONCERN",
      description:
        "The complaint text mentions a possible hygiene concern. The condition has not been independently verified.",
    });
  }

  if (reportedSignals.storageConcernMentioned) {
    reasons.push({
      code: "REPORTED_STORAGE_CONCERN",
      description:
        "The complaint text mentions possible unsafe food storage or temperature handling. Verification is required.",
    });
  }

  if (input.photoCount > 0) {
    reasons.push({
      code: "PHOTO_EVIDENCE_SUBMITTED",
      description:
        "The citizen submitted supporting photographs. Their contents and authenticity have not yet been verified.",
    });
  }

  const specificIssueReported =
    reportedSignals.illnessMentioned ||
    reportedSignals.contaminationMentioned ||
    reportedSignals.spoilageMentioned ||
    reportedSignals.pestMentioned ||
    reportedSignals.hygieneMentioned ||
    reportedSignals.storageConcernMentioned;

  let urgency: TriageUrgency = "NORMAL";
  let actionability: TriageActionability = "REVIEW_REQUIRED";

  if (
    reportedSignals.illnessMentioned &&
    reportedSignals.multiplePeopleMentioned &&
    reportedSignals.ongoingServiceMentioned
  ) {
    urgency = "URGENT";
    actionability = "ACTIONABLE";

    reasons.push({
      code: "COMBINED_URGENT_SCREENING_SIGNALS",
      description:
        "Reported illness, multiple potentially affected people and possible ongoing food service appear together. Prompt human review is recommended; none of these reports is independently verified.",
    });
  } else if (
    reportedSignals.illnessMentioned ||
    (reportedSignals.contaminationMentioned &&
      reportedSignals.ongoingServiceMentioned)
  ) {
    urgency = "HIGH";
    actionability = "ACTIONABLE";

    reasons.push({
      code: "ELEVATED_REVIEW_SIGNAL",
      description:
        "The reported information contains a signal that warrants prioritised officer review. It does not establish a food-safety violation.",
    });
  } else if (specificIssueReported) {
    urgency = "NORMAL";
    actionability = "ACTIONABLE";
  } else if (description.length < 30 || !title || !foodType) {
    urgency = "NORMAL";
    actionability = "NEEDS_INFORMATION";

    reasons.push({
      code: "LIMITED_COMPLAINT_DETAIL",
      description:
        "The available complaint text contains limited specific information. An officer may need clarification before deciding the next step.",
    });
  } else {
    urgency = "NORMAL";
    actionability = "REVIEW_REQUIRED";

    reasons.push({
      code: "NO_SPECIFIC_RULE_SIGNAL",
      description:
        "No specific triage keyword pattern was identified. This does not mean the complaint is safe or invalid; human review is still required.",
    });
  }

  return {
    urgency,
    actionability,
    reasons,
    inputSnapshot: {
      rulesVersion: RULES_VERSION,
      foodType,
      descriptionLength: description.length,
      photoCount: input.photoCount,
      reportedSignals,
    },
  };
}
