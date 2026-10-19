import { div, el } from "../utils/elements";
import * as _Sortable from "sortablejs";
import { accordion } from "../utils/accordion";
import {
  createAssignmentRequest,
  CreateAssignmentRequest,
  rawCriterionToAssignmentCriterion,
  RawCriterion,
} from "./converting";
import {
  button,
  checkboxInput,
  dropdownInput,
  getSetField,
  alignedLabeledElem,
  listInput,
  listListInput,
  multiselectInput,
  numericInput,
  textareaInput,
  textInput,
} from "../utils/inputs";
import { h1, h2, h3 } from "../utils/typography";
import {
  BUILTIN_CRITERIA,
  BuiltinPeerGradingCriteriaType,
  detectCriteriaType,
} from "../editor/peerGradingInfo";

// For some reason, the type of the exported object is mislabeled to
// be the type of the Sortable object, instead of an object which has
// as a key the Sortable object.
const Sortable = (_Sortable as any).Sortable as typeof _Sortable;

export const supportedLanguages = ["golang", "typescript"] as const;

export type AssignmentDraft = {
  professors: string[];
  tas: string[];
  groups: string[][];

  name: string;
  deadline: string;
  submissionsDir: string;
  language: (typeof supportedLanguages)[number];
  coverageLevel: number;
  pairsPerStudent: number;
  evalsPerTaPerCriteria: number;
  criteria: AssignmentCriterion[];
  freeResponse: FreeResponsePrompt[];
  selfCriteria: SelfCriterion[];
  training: TrainingPair[];
  // DB (server-side) row id; undefined for unsaved drafts.
  draftId?: number;
};

export type AssignmentCriterion = {
  name: string;
  weight: number;
  peerPreText: string;
  selfPreText: string;
  postText: string;
  postTextTa: string;
  tas: string[];
  taRubric: TaRubricItem[];
};

export type TaRubricItem = {
  name: string;
  description: string;
  maxPoints: number;
  // Whether grades should subtract from 'maxPoints', or add from 0
  subtract: boolean;
  mutuallyExclusive: boolean;
  grades: TaRubricItemGrade[];
};

export type TaRubricItemGrade = {
  name: string;
  points: number;
};

export type FreeResponsePrompt = {
  name: string;
  text: string;
  maxChar: number;
  weight: number;
};

export type SelfCriterion = {
  name: string;
  text: string;
  weight: number;
};

export type TrainingPair = {
  name: string;
  program1: string;
  program2: string;
  // One answer per criterion (0 = sub2 much better, 1= sub2 slightly better, 2= sub1 slightly better, 3 = sub1 much better)
  answers: number[];
  // One feedback string per criterion
  feedback: string[];
};

const defaultConfigCache = new Map<string, RawCriterion[]>();
async function fetchDefaultCriteria(fetchEndpoint: string, language: string): Promise<RawCriterion[]> {
  if (defaultConfigCache.has(language)) return defaultConfigCache.get(language)!;

  const res = await fetch(`${fetchEndpoint}/users/defaultConfig?language=${encodeURIComponent(language)}`);
  const json = await res.json();
  const criteria: RawCriterion[] = json.criteria ?? [];
  defaultConfigCache.set(language, criteria);
  return criteria;
}

// Update the root element with the editor. When the user presses the
// create assignment button, creationCb will be called with the body
// of the request.
export function makeAssignmentEditor(
  root: HTMLElement,
  draft: AssignmentDraft,
  creationCb: (request: CreateAssignmentRequest) => void,
  saveDraftCb: (draft: AssignmentDraft) => void,
  fetchEndpoint: string,
) {
  const update = () => makeAssignmentEditor(root, draft, creationCb, saveDraftCb, fetchEndpoint);

  // Create the category elements
  const categoryElems = draft.criteria.map((category, idx) => {
    const categoryDiv = div();
    makeCriterionElem(categoryDiv, draft, category, update);
    return listElementAccordion(
      "rubric-category",
      draft.criteria,
      idx,
      update,
      [categoryDiv],
    );
  });
  // Make the category elements sortable
  const categoriesElem = new Sortable(div("", categoryElems), {
    onEnd: (evt) => {
      rearrangeFromMove(draft.criteria, evt.oldIndex, evt.newIndex);
      // Keep all training pair answers/feedback arrays length-synced after reorder
      syncTrainingLength(draft);
      update();
    },
  }).el;

  // Pre-supported criteria checkboxes
  const builtinSection = div("mb-3");
  renderBuiltinCheckboxes(builtinSection, draft, update, fetchEndpoint);

  // FreeResponse editor
  const frElems = draft.freeResponse.map((prompt, idx) =>
    listElementAccordion(
      "fr-item",
      draft.freeResponse,
      idx,
      update,
      [makeFreeResponseElem(prompt)],
    ),
  );
  const frList = new Sortable(div("", frElems), {
    onEnd: (evt) => {
      rearrangeFromMove(draft.freeResponse, evt.oldIndex, evt.newIndex);
      update();
    },
  }).el;

  // SelfCriteria editor
  const selfElems = draft.selfCriteria.map((sc, idx) =>
    listElementAccordion(
      "self-item",
      draft.selfCriteria,
      idx,
      update,
      [makeSelfCriterionElem(sc)],
    ),
  );
  const selfList = new Sortable(div("", selfElems), {
    onEnd: (evt) => {
      rearrangeFromMove(draft.selfCriteria, evt.oldIndex, evt.newIndex);
      update();
    },
  }).el;

  // Training editor
  const trainingElems = draft.training.map((pair, idx) =>
    listElementAccordion(
      "training-pair",
      draft.training,
      idx,
      update,
      [makeTrainingPairElem(pair, draft, update)],
    ),
  );
  const trainingList = new Sortable(div("", trainingElems), {
    onEnd: (evt) => {
      rearrangeFromMove(draft.training, evt.oldIndex, evt.newIndex);
      update();
    },
  }).el;

  root.replaceChildren(
    div("rubric", [
      h1("mb-2", "Roster"),
      div("mb-4 ml-4", [
        "Fill in the professors and TAs as a comma delimited list of user IDs.",
        el("br"),
        " Fill in the student groups as a newline and comma delimited list of user IDs.",
      ]),
      alignedLabeledElem(
        "Professors",
        listInput(getSetField(draft, "professors")),
      ),
      alignedLabeledElem("TAs", listInput(getSetField(draft, "tas"), update)),
      alignedLabeledElem(
        "Students",
        listListInput(getSetField(draft, "groups")),
      ),

      h1("my-4", "Assignment Details"),
      alignedLabeledElem(
        "Assignment Name",
        textInput(getSetField(draft, "name")),
      ),
      alignedLabeledElem(
        "Deadline",
        div("", [
          textInput(getSetField(draft, "deadline")),
          div("ml-1 is-size-7 has-text-weight-medium", ["yyyy-mm-dd hh:mm:ss"]),
        ]),
      ),
      alignedLabeledElem(
        "Submissions Dir",
        div("", [
          textInput(getSetField(draft, "submissionsDir")),
          div("ml-1 is-size-7 has-text-weight-medium", ["server-side path to submissions directory"]),
        ]),
      ),
      alignedLabeledElem(
        "Language",
        dropdownInput(getSetField(draft, "language", () => {
          defaultConfigCache.clear();
          update();
        }), supportedLanguages),
      ),
      alignedLabeledElem(
        "Parse Coverage (coverageLevel=1)",
        checkboxInput([
          draft.coverageLevel === 1,
          (v) => { draft.coverageLevel = v ? 1 : 0; },
        ]),
      ),
      alignedLabeledElem(
        "Peer Evals",
        numericInput(getSetField(draft, "pairsPerStudent")),
      ),
      alignedLabeledElem(
        "TA Evals (per criteria)",
        numericInput(getSetField(draft, "evalsPerTaPerCriteria")),
      ),

      h1("my-4", "Grading Criteria"),
      div("mb-2 ml-1", ["Use the checkboxes below to include any of the five pre-supported criteria."]),
      builtinSection,
      div("accordion-hline"),
      categoriesElem,
      // Add a custom (blank) criterion
      button("mt-2 button size-90", "Add Criterion", () => {
        draft.criteria.push(<AssignmentCriterion>{
          name: "Untitled Criterion",
          weight: 0,
          selfPreText: "",
          peerPreText: "",
          postText: "",
          postTextTa: "",
          tas: [],
          taRubric: [],
        });
        syncTrainingLength(draft);
        update();
      }),

      h1("my-4", "Free Response Prompts"),
      div("mb-2 ml-1", ["Prompts shown to students after completing the MC ranking page."]),
      div("accordion-hline"),
      frList,
      button("mt-2 button size-90", "Add Prompt", () => {
        draft.freeResponse.push({ name: "Untitled Prompt", text: "", maxChar: 200, weight: 0.0 });
        update();
      }),

      h1("my-4", "Self-Evaluation Criteria"),
      div("mb-2 ml-1", ["Extra MC questions shown only during self evaluation."]),
      div("accordion-hline"),
      selfList,
      button("mt-2 button size-90", "Add Self Criterion", () => {
        draft.selfCriteria.push({ name: "Untitled Criterion", text: "", weight: 0.0 });
        update();
      }),

      h1("my-4", "Training Pairs"),
      div("mb-2 ml-1", [
        "Optional pairs of implementations used in the training module.",
        " Each pair must have one answer and one feedback string per grading criterion.",
      ]),
      div("accordion-hline"),
      trainingList,
      button("mt-2 button size-90", "Add Training Pair", () => {
        draft.training.push({
          name: "Training Pair " + (draft.training.length + 1),
          program1: "",
          program2: "",
          answers: draft.criteria.map(() => 2),
          feedback: draft.criteria.map(() => ""),
        });
        update();
      }),

      h1("my-4", "Create Assignment"),
      div("mb-4", [
        "Creating the assignment will populate the database with the roster, groups, and assignment details.",
        " Once you create an assignment, it cannot be modified.",
      ]),
      button("mb-4 button is-success", "Create Assignment", () => {
        if (
          confirm(
            "Are you sure you want to create this assignment? This action cannot be undone.",
          )
        ) {
          creationCb(createAssignmentRequest(draft));
        }
      }),
      button("ml-2 button", "Save Draft", () => {
        saveDraftCb(draft);
      }),
      button("ml-2 button", "Download Draft", () => {
        const blob = new Blob([JSON.stringify(draft)], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `assignment-${draft.name}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
      }),
      button("ml-2 button", "Import Draft", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result != "string")
              throw new Error("Invalid file type");
            const object = JSON.parse(reader.result) as AssignmentDraft;
            if (
              object &&
              typeof object == "object" &&
              typeof object.pairsPerStudent == "number"
            ) {
              Object.assign(draft, object);
              update();
            }
          };
          reader.readAsText(file);
        };
        input.click();
      }),
    ]),
  );
}

// Render the 5 builtin-criteria checkboxes.
function renderBuiltinCheckboxes(
  root: HTMLElement,
  draft: AssignmentDraft,
  update: () => void,
  fetchEndpoint: string,
) {
  const checkboxRow = div("row wrap gap-1 mb-2");

  BUILTIN_CRITERIA.forEach((builtin: BuiltinPeerGradingCriteriaType) => {
    const label = builtin.charAt(0).toUpperCase() + builtin.slice(1);
    const isIncluded = draft.criteria.some(
      (c) => detectCriteriaType(c.name).criteriaType === builtin,
    );
    const cbElem = checkboxInput([isIncluded, (checked) => {
      if (checked) {
        fetchDefaultCriteria(fetchEndpoint, draft.language).then((defaults) => {
          const raw = defaults.find((r) => detectCriteriaType(r.name).criteriaType === builtin);
          if (raw) {
            draft.criteria.push(rawCriterionToAssignmentCriterion(raw));
            syncTrainingLength(draft);
          }
          update();
        });
      } else {
        const idx = draft.criteria.findIndex(
          (c) => detectCriteriaType(c.name).criteriaType === builtin,
        );
        if (idx !== -1) {
          draft.criteria.splice(idx, 1);
          syncTrainingLength(draft);
          update();
        }
      }
    }], div("ml-1", [label]));
    checkboxRow.appendChild(div("mr-3", [cbElem]));
  });

  root.replaceChildren(checkboxRow);
}

// Keep all training pair answers/feedback arrays synced to draft.criteria.length.
function syncTrainingLength(draft: AssignmentDraft) {
  const n = draft.criteria.length;
  for (const pair of draft.training) {
    while (pair.answers.length < n) pair.answers.push(2);
    pair.answers.length = n;
    while (pair.feedback.length < n) pair.feedback.push("");
    pair.feedback.length = n;
  }
}

// Create an element for editing a criteria category
function makeCriterionElem(
  root: HTMLElement,
  assignment: AssignmentDraft,
  criterion: AssignmentCriterion,
  updateParent: () => void,
) {
  const update = () => makeCriterionElem(root, assignment, criterion, updateParent);

  // Create the criteria for this category
  const criteriaElems = criterion.taRubric.map((criteria, criteriaIdx) => {
    const criteriaDiv = div();
    makeRubricItemElem(criteriaDiv, criteria);
    return listElementAccordion(
      "rubric-criteria",
      criterion.taRubric,
      criteriaIdx,
      update,
      [criteriaDiv],
    );
  });

  const criteriasElem = new Sortable(div("", criteriaElems), {
    onEnd: (evt) => {
      rearrangeFromMove(criterion.taRubric, evt.oldIndex, evt.newIndex);
      update();
    },
  }).el;

  root.replaceChildren(
    h2("mb-3", "Criteria Item Details"),
    alignedLabeledElem(
      "Weight",
      numericInput(getSetField(criterion, "weight")),
    ),
    alignedLabeledElem(
      "TAs",
      multiselectInput(getSetField(criterion, "tas"), assignment.tas),
    ),
    alignedLabeledElem(
      "Self Pre-Text",
      textareaInput(getSetField(criterion, "selfPreText")),
    ),
    alignedLabeledElem(
      "Peer Pre-Text",
      textareaInput(getSetField(criterion, "peerPreText")),
    ),
    alignedLabeledElem(
      "Post-Text",
      textareaInput(getSetField(criterion, "postText")),
    ),
    alignedLabeledElem(
      "Post-Text (TA only)",
      textareaInput(getSetField(criterion, "postTextTa")),
    ),

    h2("my-2", "TA Rubric"),
    div("accordion-hline"),
    criteriasElem,

    button("button size-90 mt-2", "Add Rubric Item", () => {
      criterion.taRubric.push(<TaRubricItem>{
        name: "",
        description: "",
        maxPoints: 10,
        subtract: false,
        mutuallyExclusive: true,
        grades: [{ name: "", points: 0 }],
      });
      update();
    }),
  );
}

// Create an element for editing a ta criteria
function makeRubricItemElem(root: HTMLElement, rubricItem: TaRubricItem) {
  const gradeElems = rubricItem.grades.map((grade) =>
    div("row w-100 align-center", [
      el("i", "fas fa-ellipsis-v rubric-drag-icon inline-block", []),
      div("is-large has-text-weight-bold px-2", [
        rubricItem.subtract ? "–" : "+",
      ]),
      numericInput(getSetField(grade, "points"), "size-80 input mr-2"),
      textareaInput(getSetField(grade, "name"), "size-80 input"),
    ]),
  );

  const gradesElem = new Sortable(div("mb-2", gradeElems), {
    onEnd: (evt) => {
      rearrangeFromMove(rubricItem.grades, evt.oldIndex, evt.newIndex);
      makeRubricItemElem(root, rubricItem);
    },
  }).el;

  root.replaceChildren(
    alignedLabeledElem(
      "Description",
      textareaInput(getSetField(rubricItem, "description")),
    ),
    alignedLabeledElem(
      "Point Value",
      numericInput(getSetField(rubricItem, "maxPoints")),
    ),
    alignedLabeledElem(
      "Mutually Exclusive",
      checkboxInput(getSetField(rubricItem, "mutuallyExclusive")),
    ),
    alignedLabeledElem(
      "Subtract Points",
      checkboxInput(
        getSetField(rubricItem, "subtract", () => {
          for (const grade of rubricItem.grades) {
            grade.points = rubricItem.maxPoints - grade.points;
          }
          makeRubricItemElem(root, rubricItem);
        }),
      ),
    ),

    h3("my-2", "Grades"),

    gradesElem,
    button("button size-80 mr-2", "Add", () => {
      rubricItem.grades.push({ name: "", points: 0 });
      makeRubricItemElem(root, rubricItem);
    }),
    button("button size-80 mr-2", "Remove", () => {
      if (rubricItem.grades.length > 1) {
        rubricItem.grades.splice(rubricItem.grades.length - 1, 1);
        makeRubricItemElem(root, rubricItem);
      }
    }),
  );
}

function makeFreeResponseElem(prompt: FreeResponsePrompt): HTMLElement {
  const root = div();
  root.replaceChildren(
    alignedLabeledElem("Prompt", textareaInput(getSetField(prompt, "text"))),
    alignedLabeledElem("Max Chars", numericInput(getSetField(prompt, "maxChar"))),
    alignedLabeledElem("Weight", numericInput(getSetField(prompt, "weight"))),
  );
  return root;
}

function makeSelfCriterionElem(sc: SelfCriterion): HTMLElement {
  const root = div();
  root.replaceChildren(
    alignedLabeledElem("Text", textareaInput(getSetField(sc, "text"))),
    alignedLabeledElem("Weight", numericInput(getSetField(sc, "weight"))),
  );
  return root;
}

function makeTrainingPairElem(
  pair: TrainingPair,
  draft: AssignmentDraft,
  update: () => void,
): HTMLElement {
  const root = div();

  const answerRows = draft.criteria.map((criterion, i) => {
    const criterionLabel = div("is-size-7 mb-1 has-text-weight-medium", [
      criterion.name.replace(/<[^>]+>/g, ""),
    ]);
    return div("mb-2 p-2 has-background-light", [
      criterionLabel,
      alignedLabeledElem(
        "Answer (0–3)",
        numericInput([pair.answers[i], (v) => { pair.answers[i] = v; }]),
      ),
      alignedLabeledElem(
        "Feedback",
        textareaInput([pair.feedback[i], (v) => { pair.feedback[i] = v; }]),
      ),
    ]);
  });

  root.replaceChildren(
    alignedLabeledElem("Program 1 Path", textInput(getSetField(pair, "program1"))),
    alignedLabeledElem("Program 2 Path", textInput(getSetField(pair, "program2"))),
    div("mb-1 mt-2 has-text-weight-semibold", ["Answers & Feedback (one per criterion)"]),
    div("mb-1 is-size-7 ml-1", ["0 = Sub 2 much better, 1 = Sub 2 slightly better, 2 = Sub 1 slightly better, 3 = Sub 1 much better"]),
    ...answerRows,
  );
  return root;
}

// Create an accordion element which can be reordered within a draggable container.
function listElementAccordion<T extends { name: string }>(
  className: string,
  list: T[],
  index: number,
  update: () => void,
  body: HTMLElement[],
): HTMLElement {
  return div(`rubric-box ${className}`, [
    accordion(
      div("row w-100 align-center", [
        el("i", "fas fa-ellipsis-v rubric-drag-icon inline-block", []),
        list[index].name,
        // Space in the middle of the heading
        div("flex-1"),
        // Rename button
        button("p-1 mx-1 fas fa-pen", "", (event) => {
          event.stopPropagation();
          const newName = prompt("Rename Item:");
          if (newName) {
            list[index].name = newName;
            update();
          }
        }),
        // Delete button
        button("p-1 mx-1 fas fa-trash", "", (event) => {
          event.stopPropagation();
          if (confirm("Are you sure? This action cannot be undone.")) {
            list.splice(index, 1);
            update();
          }
        }),
      ]),
      [div("p-4", body)],
      className,
      false,
    ),
  ]);
}

// Remove an element from the 'from' index in array, and insert it at the 'to' index in array.
function rearrangeFromMove<T>(array: T[], from: number, to: number) {
  const moved = array[from];
  array.splice(from, 1);
  array.splice(to, 0, moved);
}
