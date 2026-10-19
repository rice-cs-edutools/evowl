// This file is for converting the assignment draft format which is
// used by the frontend and stored in JSON into the format expected by
// the instructor tool.

import { AssignmentCriterion, AssignmentDraft, TaRubricItem } from "./rubric";

// This contains all data required for the server to create an assignment
export type CreateAssignmentRequest = {
  rosterCsv: string;
  criteriaJson: string;
  groupsJson: string;
  name: string;
  deadline: string;
  submissionsDir: string;
};

export function createAssignmentRequest(
  draft: AssignmentDraft,
): CreateAssignmentRequest {
  return {
    rosterCsv: createRosterCsv(draft),
    criteriaJson: JSON.stringify(createCriteriaFile(draft)),
    groupsJson: JSON.stringify(createGroupsFile(draft)),
    name: draft.name,
    deadline: draft.deadline,
    submissionsDir: draft.submissionsDir,
  };
}

type GroupsFileFormat = { [groupName: string]: string[] };

// `criteria` = MC rubric entries only. `freeResponse` = post-ranking free-response prompts only.
// The section name is the single source of truth for type — no isFreeResponse flag needed.
type CriteriaFileFormat = {
  assignment: string;
  id: string;
  pairsPerStudent: number;
  evalsPerTaPerCriteria: number;
  language: string;
  coverageLevel: number;
  criteria: {
    name: string;
    peerPreText: string;
    selfPreText: string;
    postText: string;
    postTextTa?: string;
    tas: string[];
    weight: number;
    taRubric: {
      text: string;
      pts: number;
      isHeader: boolean;
      mutuallyExclusive?: boolean;
    }[];
  }[];
  training: {
    program1: string;
    program2: string;
    answers: number[];
    feedback: string[];
  }[];
  freeResponse: {
    text: string;
    maxChar: number;
    weight: number;
  }[];
  selfCriteria: { text: string; weight: number }[];
};

// Raw criterion format. Mirrors the format stored in the default config JSON files for each language.
export type RawCriterion = {
  name: string;
  peerPreText: string;
  selfPreText: string;
  postText: string;
  postTextTa?: string;
  tas: string[];
  weight: number;
  taRubric: {
    text: string;
    pts: number;
    isHeader: boolean;
    mutuallyExclusive?: boolean;
  }[];
};

// Inverse of the taRubric flatten in createCriteriaFile: regroups flat header/item rows back
// into TaRubricItem[]. Header text format: `<b>name</b>description`.
export function rawCriterionToAssignmentCriterion(raw: RawCriterion): AssignmentCriterion {
  const taRubric: TaRubricItem[] = [];
  let current: TaRubricItem | null = null;

  for (const row of raw.taRubric) {
    if (row.isHeader) {
      if (current) taRubric.push(current);
      const match = row.text.match(/^<b>(.*?)<\/b>([\s\S]*)$/);
      const name = match ? match[1] : row.text;
      const description = match ? match[2].trim() : "";
      current = {
        name,
        description,
        maxPoints: 10,
        subtract: false,
        mutuallyExclusive: row.mutuallyExclusive ?? true,
        grades: [],
      };
    } else if (current) {
      current.grades.push({ name: row.text, points: row.pts });
    }
  }
  if (current) taRubric.push(current);

  return {
    name: raw.name,
    weight: raw.weight,
    peerPreText: raw.peerPreText,
    selfPreText: raw.selfPreText,
    postText: raw.postText,
    postTextTa: raw.postTextTa ?? "",
    tas: raw.tas,
    taRubric,
  };
}

function createRosterCsv(draft: AssignmentDraft): string {
  const students = draft.groups.flatMap((group) =>
    group.map((userId) => ["l-" + userId, "f-" + userId, userId, "student"]),
  );
  const tas = draft.tas.map((userId) => [
    "l-" + userId,
    "f-" + userId,
    userId,
    "ta",
  ]);
  const profs = draft.professors.map((userId) => [
    "l-" + userId,
    "f-" + userId,
    userId,
    "professor",
  ]);
  const all = [...students, ...tas, ...profs];
  return all.map((row) => row.join(",")).join("\n");
}

function createGroupsFile(draft: AssignmentDraft): GroupsFileFormat {
  const groups = <GroupsFileFormat>{};

  for (let i = 0; i < draft.groups.length; i++) {
    const name = "Group" + (i + 1).toString().padStart(2, "0");
    // Create a copy so that future mutations don't cause side effects
    groups[name] = [...draft.groups[i]];
  }

  return groups;
}

function createCriteriaFile(draft: AssignmentDraft): CriteriaFileFormat {
  return {
    assignment: draft.name,
    id: draft.name,
    pairsPerStudent: draft.pairsPerStudent,
    evalsPerTaPerCriteria: draft.evalsPerTaPerCriteria,
    language: draft.language,
    coverageLevel: draft.coverageLevel,
    criteria: draft.criteria.map((criterion) => {
      const entry: CriteriaFileFormat["criteria"][number] = {
        name: criterion.name,
        peerPreText: criterion.peerPreText,
        selfPreText: criterion.selfPreText,
        postText: criterion.postText,
        tas: criterion.tas,
        weight: criterion.weight,
        taRubric: criterion.taRubric.flatMap((item) => {
          const header = {
            text: `<b>${item.name}</b>${item.description}`,
            isHeader: true,
            pts: 0,
            mutuallyExclusive: item.mutuallyExclusive,
          };
          const grades = item.grades.map((grade) => ({
            text: grade.name,
            isHeader: false,
            pts: grade.points,
          }));
          return [header, ...grades];
        }),
      };
      if (criterion.postTextTa) entry.postTextTa = criterion.postTextTa;
      return entry;
    }),
    training: draft.training.map(({ name: _n, ...rest }) => rest),
    freeResponse: draft.freeResponse.map(({ name: _n, ...rest }) => rest),
    selfCriteria: draft.selfCriteria.map(({ name: _n, ...rest }) => rest),
  };
}
