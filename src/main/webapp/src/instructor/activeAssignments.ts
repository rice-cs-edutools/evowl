import { accordion } from "../utils/accordion";
import { div, el } from "../utils/elements";
import { h1, h2, h3, semibold } from "../utils/typography";
import { ActiveAssignment, InstructorDashboardInfo } from "./dashboard";

export type PeerEvalSubmission = {
  uniqueId: string;
  submitTime: string;
  choices: string;
  freeResponses: string;
  group1: string;
  group2: string;
};

export type SelfEvalSubmission = {
  uniqueId: string;
  submitTime: string;
  choices: string;
  freeResponses: string;
};

export function makeActiveAssignmentsViewer(
  root: HTMLElement,
  info: InstructorDashboardInfo,
) {
  if (info.assignments.length == 0) {
    root.replaceChildren(
      "There are no active assignments.",
      " Visit the Create Assignment page to create one.",
    );
  } else {
    root.replaceChildren(
      h1("mb-4", "Active Assignments"),
      div(
        "",
        info.assignments.map((assn) => makeActiveAssignmentElem(div(), assn)),
      ),
    );
  }
}

function makeActiveAssignmentElem(root: HTMLElement, assn: ActiveAssignment) {
  root.replaceChildren(
    div("accordion-hline"),
    accordion(
      div("pl-2", [`${assn.name} [${assn.id}]`]),
      div("p-4", [
        div("pb-2", [semibold("Due: "), assn.deadline]),

        h2("my-2", "Peer Evals"),
        div("accordion-hline"),
        assn.peerEvals.map((e) => peerEvalElem(assn, e)),

        h2("my-2", "Self Evals"),
        div("accordion-hline"),
        assn.selfEvals.map((e) => selfEvalElem(assn, e)),
      ]),
      "active-assignments",
    ),
  );
  return root;
}

function selfEvalElem(
  assn: ActiveAssignment,
  subm: SelfEvalSubmission,
): HTMLElement {
  const dashIdx = subm.uniqueId.indexOf("-");
  const name = subm.uniqueId.substring(0, dashIdx);
  const index = +subm.uniqueId.substring(dashIdx + 1);

  const freeResponse = JSON.parse(subm.freeResponses) as {
    [q: string]: string;
  };
  const answers = Object.entries(freeResponse).map(([q, val]) => {
    const qText =
      assn.criteria.find((crit) => crit.criteriaId == +q)?.criteriaText ?? q;
    return div("pl-4", [
      el("span", "has-text-weight-medium", [qText, ": "]),
      val,
    ]);
  });

  return accordion(
    div("pl-2", [`${name} submission #${index + 1}`]),
    div("p-2", [
      el("span", "has-text-weight-semibold", "Submitted at: "),
      subm.submitTime,
      el("br"),
      el("span", "has-text-weight-semibold", "Choices: "),
      subm.choices,
      el("br"),
      answers,
    ]),
    "active-assignment-submission",
  );
}

function peerEvalElem(
  assn: ActiveAssignment,
  subm: PeerEvalSubmission,
): HTMLElement {
  const dashIdx = subm.uniqueId.indexOf("-");
  const name = subm.uniqueId.substring(0, dashIdx);
  const index = +subm.uniqueId.substring(dashIdx + 1);

  return accordion(
    div("pl-2", [`${name} submission #${index + 1}`]),
    [
      div("p-2", [
        el("span", "has-text-weight-semibold", ["Submitted at: "]),
        subm.submitTime,
        el("br"),
        el("span", "has-text-weight-semibold", ["Choices: "]),
        subm.choices,
        el("br"),
        peerEvalGroupResponses(assn, subm, 1),
        peerEvalGroupResponses(assn, subm, 2),
      ]),
    ],
    "active-assignment-submission",
  );
}

function peerEvalGroupResponses(
  assn: ActiveAssignment,
  subm: PeerEvalSubmission,
  idx: 1 | 2,
): HTMLElement {
  const header = h3("", [
    "Answers for ",
    idx == 1 ? subm.group1 : subm.group2,
    ":",
  ]);

  const freeResponse = JSON.parse(subm.freeResponses) as {
    [q: string]: { [g: string]: string };
  };
  const answers = Object.entries(freeResponse).map(([q, val]) => {
    const qText =
      assn.criteria.find((crit) => crit.criteriaId == +q)?.criteriaText ?? q;
    return div("pl-4", [semibold([qText, ": "]), val[idx]]);
  });

  return div("", [header, ...answers]);
}
