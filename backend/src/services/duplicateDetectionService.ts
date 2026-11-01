
export interface ComplaintMatchInput {
  title: string;
  description: string;
  foodType: string;
  establishmentName: string;
  location: string;
}

export interface ExistingComplaint {
  id: number;
  title: string;
  description: string;
  foodType: string;
  establishmentName: string;
  location: string;
  incidentDate: Date;
  status: string;
  createdAt: Date;
}

export interface DuplicateMatch {
  complaintId: number;
  similarity: number;
  reasons: string[];
  status: string;
  incidentDate: Date;
  createdAt: Date;
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (value: string): Set<string> =>
  new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length > 2)
  );

const jaccardSimilarity = (
  first: string,
  second: string
): number => {
  const a = tokens(first);
  const b = tokens(second);

  if (a.size === 0 || b.size === 0) return 0;

  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;

  return intersection / union;
};

const sameValue = (first: string, second: string): boolean =>
  normalize(first) !== "" &&
  normalize(first) === normalize(second);

export function findSimilarComplaints(
  incoming: ComplaintMatchInput,
  existingComplaints: ExistingComplaint[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const existing of existingComplaints) {
    const reasons: string[] = [];

    const sameEstablishment = sameValue(
      incoming.establishmentName,
      existing.establishmentName
    );

    const sameLocation = sameValue(
      incoming.location,
      existing.location
    );

    const sameFoodType = sameValue(
      incoming.foodType,
      existing.foodType
    );

    const descriptionSimilarity = jaccardSimilarity(
      incoming.description,
      existing.description
    );

    const titleSimilarity = jaccardSimilarity(
      incoming.title,
      existing.title
    );

    if (sameEstablishment) reasons.push("Same establishment name");
    if (sameLocation) reasons.push("Same reported location");
    if (sameFoodType) reasons.push("Same food category");

    if (descriptionSimilarity >= 0.35) {
      reasons.push("Similar complaint description");
    }

    if (titleSimilarity >= 0.35) {
      reasons.push("Similar complaint title");
    }

    const score =
      (sameEstablishment ? 0.30 : 0) +
      (sameLocation ? 0.20 : 0) +
      (sameFoodType ? 0.10 : 0) +
      descriptionSimilarity * 0.25 +
      titleSimilarity * 0.15;

    const hasStrongEvidence =
  (sameEstablishment &&
    (descriptionSimilarity >= 0.35 ||
      titleSimilarity >= 0.35 ||
      (sameLocation && sameFoodType))) ||
  (sameLocation && descriptionSimilarity >= 0.35) ||
  descriptionSimilarity >= 0.65;

    if (score >= 0.45 && hasStrongEvidence) {
      matches.push({
        complaintId: existing.id,
        similarity: Math.round(score * 100),
        reasons,
        status: existing.status,
        incidentDate: existing.incidentDate,
        createdAt: existing.createdAt,
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}
