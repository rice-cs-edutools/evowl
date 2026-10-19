import { div } from "../utils/elements";
import { createMenuedPage } from "../utils/menu";
import {
  makeActiveAssignmentsViewer,
  PeerEvalSubmission,
  SelfEvalSubmission,
} from "./activeAssignments";
import { CreateAssignmentRequest } from "./converting";
import { AssignmentDraft, makeAssignmentEditor } from "./rubric";

export type ActiveAssignment = {
  id: number;
  name: string;
  deadline: string;
  peerEvals: PeerEvalSubmission[];
  selfEvals: SelfEvalSubmission[];
  criteria: ActiveAssignmentCriteria[];
};

export type ActiveAssignmentCriteria = {
  criteriaId: number;
  criteriaText: string;
  evalType: number;
  maxChar: number;
  isFreeResponse: number;
};

export type InstructorDashboardInfo = {
  assignments: ActiveAssignment[];
  drafts: (AssignmentDraft & { draftId: number })[];
};

export function makeInstructorDashboard(
  root: HTMLElement,
  info: InstructorDashboardInfo,
  creationCb: (request: CreateAssignmentRequest) => void,
  fetchEndpoint: string,
) {
  const draft = info.drafts[0] ?? createBlankDraft();

  const assignmentEditor = div();
  const assignmentsViewer = div();

  root.replaceChildren(
    div("instructor-dashboard", [
      createMenuedPage("Instructor Dashboard", [
        ["Create Assignment", "far fa-plus-square", assignmentEditor],
        ["Active Assignments", "fas fa-tasks", assignmentsViewer],
      ]),
    ]),
  );

  const saveDraftCb = async (d: AssignmentDraft) => {
    try {
      const res = await fetch(fetchEndpoint + "/users/saveDraft", {
        method: "POST",
        body: JSON.stringify(d),
        mode: "cors",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.draftId != null) d.draftId = data.draftId;
      alert(data.special_error ? "Save failed: " + data.special_error : "Draft saved.");
    } catch (e) {
      alert("Draft save failed: " + e);
    }
  };

  try {
    makeAssignmentEditor(assignmentEditor, draft, creationCb, saveDraftCb, fetchEndpoint);
    makeActiveAssignmentsViewer(assignmentsViewer, info);
  } catch (error) {
    console.error("Failed to render instructor dashboard", {
      error,
      draft,
      assignmentsCount: info.assignments?.length ?? 0,
      draftsCount: info.drafts?.length ?? 0,
    });
    assignmentEditor.replaceChildren(
      "Unable to load Create Assignment editor. See browser console for details.",
    );
    assignmentsViewer.replaceChildren(
      "Unable to load Active Assignments. See browser console for details.",
    );
  }
}

function createBlankDraft(): AssignmentDraft {
  return {
    professors: [],
    tas: [],
    groups: [],
    name: "",
    deadline: "",
    submissionsDir: "",
    language: "golang",
    coverageLevel: 0,
    pairsPerStudent: 3,
    evalsPerTaPerCriteria: 3,
    criteria: [],
    freeResponse: [
      { name: "Best Design Choice", text: "Describe the single best design choice of each submission.", maxChar: 200, weight: 0.0 },
      { name: "Suggested Improvement", text: "Describe the single most significant way in which the design of each submission could be improved.", maxChar: 200, weight: 0.0 },
    ],
    selfCriteria: [],
    training: [],
  };
}
