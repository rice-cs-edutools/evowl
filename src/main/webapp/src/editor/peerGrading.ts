import {
    createElement,
    IconNode,
    ChevronsLeft,
    ChevronLeft,
    ChevronsRight,
    ChevronRight,
    SeparatorVertical,
    Info,
} from "lucide";
import { div, el, ElementChild, htmlEl } from "../utils/elements";
import { button, getSetField, multiButtonInput } from "../utils/inputs";
import { h3 } from "../utils/typography";
import { FileInfo } from "./editor";
import { makeMetricsEditor } from "./metrics";
import z from "zod";
import {
    BuiltinPeerGradingCriteriaType,
    detectCriteriaType,
    LanguageTerminology,
    PeerGradingCriteriaType,
} from "./peerGradingInfo";
import { CriteriaPage, todoIcon } from "./metrics/common";
import { ModularityPage, TaModularityPage } from "./metrics/modularity";
import { DecouplingPage, TaDecouplingPage } from "./metrics/decoupling";
import { EncapsulationPage, TaEncapsulationPage } from "./metrics/encapsulation";
import { ClarityPage, TaClarityPage } from "./metrics/clarity";
import { RobustnessPage, TaRobustnessPage } from "./metrics/robustness";
import { BlankMetricsPageInfo, BlankPage } from "./metrics/blank";

function allowSkipping(): boolean {
    return localStorage.getItem("allow-skipping") === "yes please";
}

const filesSchema = z.array(z.tuple([z.string(), z.string()]));

type PeerGradingPageArgs = {
    root: HTMLElement;
    files1: FileInfo[];
    files2: FileInfo[];
    gradingInfo: LanguageTerminology;
    onSubmit: (criteria: string[], group1: string, group2: string) => void;
    showInstructions: () => void;
    extraQuestions?: HTMLElement;
    criteriaTypes: { criteriaType: PeerGradingCriteriaType; title: string }[];
};

export function makePeerGradingPage(args: PeerGradingPageArgs) {
    try {
        makePeerGradingPageLogic(args);
    } catch (e) {
        console.error("Error creating metrics:", e);
    }
}


export function makePeerGradingPageLogic(args: PeerGradingPageArgs) {
    const { root, files1, files2, gradingInfo, onSubmit, showInstructions, extraQuestions } = args;

    filesSchema.parse(files1);
    filesSchema.parse(files2);

    const submitRoot = div("col p-6 w-content border-1 round-1");
    submitRoot.style.minWidth = "60%";
    const submitContainer = div("col align-center pt-4 h-100 overflow-auto", submitRoot);
    submitContainer.style.display = "none";

    const titleButtons: HTMLButtonElement[] = [];
    const pageContainers: HTMLElement[] = [];
    const pages: PeerCriteriaPage<any, any>[] = [];

    function makeSubmitPage() {
        // Setup the submit page
        const submittable = allowSkipping() || pages.every((page) => page.isComplete());
        submitRoot.replaceChildren(
            div("row justify-center gap-2", [
                pages.map((page) =>
                    div("col align-center px-4", [
                        h3("pb-2", page.title()),
                        div(
                            "p-4 border-1 round-1",
                            !page.isComplete()
                                ? div("has-text-danger has-text-weight-semibold", "INCOMPLETE")
                                : criteriaGradeOptionLabels().flatMap(([index, text, icon]) =>
                                      index === page.grades.comparison
                                          ? [div("col gap-1 align-center", [icon, text])]
                                          : [],
                                  ),
                        ),
                    ]),
                ),
            ]),
            el("br"),
            el("br"),
            ...(extraQuestions ? [extraQuestions] : []),
            ...(!submittable
                ? [
                      div("has-text-danger text-center", [
                          "You must grade each criteria before you can submit.",
                      ]),
                  ]
                : [
                      div("text-center", [
                          "Please review your answers before submitting.",
                          el("br"),
                          "Once you submit, you cannot change your answers.",
                          el("br"),
                      ]),
                      div("pt-4 col align-center", [
                          button(`button ${submittable ? "" : "is-static"}`, "Submit", () => {
                              onSubmit(
                                  pages.map((page) => `${page.grades.comparison}`),
                                  JSON.stringify(pages.map((page) => page.grades.group1)),
                                  JSON.stringify(pages.map((page) => page.grades.group2)),
                              );
                          }),
                      ]),
                  ]),
        );
    }

    function addTitleButton(todo: ElementChild, title: string, r: HTMLElement, and: () => void) {
        // Create a button to switch to this page
        const onclick = () => {
            pageContainers.forEach((body) => (body.style.display = "none"));
            r.style.display = "flex";
            titleButtons.forEach((btn) => {
                btn.classList.remove("active");
            });
            titleButton.classList.add("active");
            and();
        };
        const heading = h3("row align-center gap-1", [todo, title]);
        const titleButton = button("peer-criteria-title-button", heading, onclick);
        if (titleButtons.length > 0) {
            if (!allowSkipping()) titleButton.disabled = true;
        } else {
            onclick();
        }
        titleButtons.push(titleButton);
    }

    function setWhichPagesAreShowing() {
        let allCompleted = true;
        for (let i = 0; i < titleButtons.length; i++) {
            titleButtons[i].disabled = !allowSkipping() && !allCompleted;
            allCompleted = allCompleted && pages[i]?.isComplete();
        }
        makeSubmitPage();
    }

    function createPeerPage<G, D>(
        page: CriteriaPage<G, D>,
        onChange: ((complete: boolean) => void) | null = null,
        deps: { group1: D; group2: D } = { group1: undefined, group2: undefined },
    ): PeerCriteriaPage<G, D> {
        const pageRoot = div("h-100 col", [], {}, { display: "none" });
        pageContainers.push(pageRoot);

        // Create a todo indicator that updates when the page status changes
        const todoContainer = div("pt-1");
        let wasComplete: boolean | null = null;
        const wrapOnChange = (complete: boolean) => {
            if (complete !== wasComplete) {
                wasComplete = complete;
                todoContainer.replaceChildren(todoIcon(complete));
                setWhichPagesAreShowing();
            }
            onChange?.(complete);
        };

        const peerPage = new PeerCriteriaPage<G, D>(
            page,
            gradingInfo,
            pageRoot,
            files1,
            files2,
            wrapOnChange,
            deps,
        );
        const pageTitle = gradingInfo.criteriaTitle(page.criteriaType);
        addTitleButton(todoContainer, pageTitle, pageRoot, () => peerPage.rerenderIfNeeded());
        pages.push(peerPage);
        return peerPage;
    }

    let encapsulationPage: PeerCriteriaPage<any, any> | null = null;
    let modularityPage: PeerCriteriaPage<any, any> | null = null;
    let updateClarity = () => {};
    let updateDecoupling = () => {};

    for (const { criteriaType, title } of args.criteriaTypes) {
        switch (criteriaType) {
            case "encapsulation": {
                encapsulationPage = createPeerPage(new EncapsulationPage(), () => updateClarity());
                break;
            }
            case "modularity": {
                modularityPage = createPeerPage(new ModularityPage(), () => updateDecoupling());
                break;
            }
            case "decoupling": {
                const dp = modularityPage
                    ? createPeerPage(new DecouplingPage(), undefined, modularityPage.grades)
                    : createPeerPage(new TaDecouplingPage(), undefined, undefined);
                updateDecoupling = () => (dp.isUpToDate = false);
                break;
            }
            case "clarity": {
                const cp = encapsulationPage
                    ? createPeerPage(new ClarityPage(), undefined, encapsulationPage.grades)
                    : createPeerPage(new TaClarityPage(), undefined, undefined);
                updateClarity = () => (cp.isUpToDate = false);
                break;
            }
            case "robustness": {
                createPeerPage(new RobustnessPage());
                break;
            }
            default: {
                createPeerPage(new BlankPage({ criteriaType, title }));
                break;
            }
        }
    }

    pageContainers.push(submitContainer);
    addTitleButton(null, "Submit", submitContainer, () => makeSubmitPage());

    root.replaceChildren(
        div("fullscreen col overflow-hidden", [
            div("bg2 p-2 row align-center gap-1", [
                div(
                    "shrink-0",
                    button(
                        "size-80 row gap-1 align-center button has-background-link has-text-white is-outlined",
                        [createElement(Info), "Instructions"],
                        showInstructions,
                    ),
                ),
                div("row align-stretch overflow-x-auto flex-1", [
                    div(
                        "row align-stretch w-content",
                        titleButtons.flatMap((btn, idx) => [
                            ...(idx === 0
                                ? []
                                : [
                                      div(
                                          "row align-center",
                                          createElement(ChevronRight, {
                                              height: 40,
                                              "stroke-width": 2.7,
                                              color: "#888",
                                          }),
                                      ),
                                  ]),
                            btn,
                        ]),
                    ),
                ]),
            ]),
            div("flex-1 h-0", pageContainers),
        ]),
    );

    setWhichPagesAreShowing();
}

export function makeTaInterface(
    root: HTMLElement,
    metricDescription: string,
    files: FileInfo[],
    gradingInfo: LanguageTerminology,
    onChange: (data: string, done: boolean) => void,
): any {
    filesSchema.parse(files);

    const { criteriaType, title } = detectCriteriaType(metricDescription);
    const taPageConstructors: Partial<
        Record<BuiltinPeerGradingCriteriaType, new () => CriteriaPage<any, any>>
    > = {
        encapsulation: TaEncapsulationPage,
        modularity: TaModularityPage,
        decoupling: TaDecouplingPage,
        clarity: TaClarityPage,
        robustness: TaRobustnessPage,
    };
    const PageConstructor = taPageConstructors[criteriaType as BuiltinPeerGradingCriteriaType];
    const criteriaPage: CriteriaPage<any, any> = PageConstructor
        ? new PageConstructor()
        : new BlankPage({ criteriaType, title });
    return makeTaInterfaceForCriteria(root, criteriaPage, files, gradingInfo, onChange);
}

export function makeTaInterfaceForCriteria<G>(
    root: HTMLElement,
    criteriaPage: CriteriaPage<G, undefined>,
    files: FileInfo[],
    gradingInfo: LanguageTerminology,
    onChange: (data: string, done: boolean) => void,
): G {
    // const criteriaTitle = gradingInfo.criteriaTitle(criteriaPage.criteriaType);
    const criteriaTaInstructions = gradingInfo.taInstructions(criteriaPage.criteriaType);

    // Load localStorage grades
    const localStorageKey = "tagrade---" + criteriaPage.localstorageKey() + "-" + fastHash(files);
    const existingGradesJson = localStorage.getItem(localStorageKey);
    const existingGradesResult = criteriaPage.groupGradeSchema.safeParse(
        existingGradesJson ? JSON.parse(existingGradesJson) : null,
    );
    const useStoredGrades = existingGradesResult.success;
    const storedGrades = existingGradesResult.data as G;

    const topLabel = div("size-90 my-3", criteriaTaInstructions);
    let grades: G;
    makeMetricsEditor(root, files, gradingInfo.fileGroupMethod(), (root, info) => {
        grades = useStoredGrades ? storedGrades : criteriaPage.createGroupGrade(info.metrics);
        const onChangeWrapped = () => {
            localStorage.setItem(localStorageKey, JSON.stringify(grades));
            onChange(
                JSON.stringify(grades),
                criteriaPage.isGroupGradeComplete(grades, gradingInfo),
            );
        };
        criteriaPage.makeSidebar(
            gradingInfo,
            root,
            info,
            onChangeWrapped,
            grades,
            topLabel,
            undefined,
        );
        return grades;
    });
    onChange(JSON.stringify(grades!), criteriaPage.isGroupGradeComplete(grades!, gradingInfo));
    return grades!;
}

// ==================== Pages ====================

function fastHash(obj: any) {
    const str = JSON.stringify(obj);
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    // force to unsigned 32-bit
    return (hash >>> 0).toString(16);
}

const optionIcon = (icon: IconNode) => createElement(icon, { height: 24, "stroke-width": 2.3 });
const criteriaGradeOptionLabels = () =>
    [
        [3, "Implementation 1 much better", optionIcon(ChevronsLeft)],
        [2, "Implementation 1 slightly better", optionIcon(ChevronLeft)],
        // [3, "About equal", optionIcon(Equal)],
        [1, "Implementation 2 slightly better", optionIcon(ChevronRight)],
        [0, "Implementation 2 much better", optionIcon(ChevronsRight)],
    ] as const;

type CriteriaGrade<G> = {
    comparison: null | 0 | 1 | 2 | 3;
    group1: G;
    group2: G;
};

class PeerCriteriaPage<G, D> {
    public grades: CriteriaGrade<G>;

    public title(): string {
        return this.gradingInfo.criteriaTitle(this.criteriaPage.criteriaType);
    }
    public questionText(): string {
        return this.gradingInfo.criteriaQuestion(this.criteriaPage.criteriaType);
    }

    private rerender1: () => void;
    private rerender2: () => void;
    public isUpToDate = false;
    public rerenderIfNeeded() {
        if (this.isUpToDate) return;
        this.isUpToDate = true;
        this.rerender1();
        this.rerender2();
    }

    public lastState: "done" | "notdone" | null = null;
    private localStorageKey: string;

    public constructor(
        private criteriaPage: CriteriaPage<G, D>,
        private gradingInfo: LanguageTerminology,
        root: HTMLElement,
        private group1Files: FileInfo[],
        private group2Files: FileInfo[],
        onChange: (complete: boolean) => void,
        deps: { group1: D; group2: D },
    ) {
        this.localStorageKey =
            "peergrade---" + this.title() + "-" + fastHash([group1Files, group2Files]);
        const editor1Root = div("shrink-1 row align-stretch overflow-hidden left-editor");
        const resizeBorder = div(
            "resize-border border-bottom",
            div("resize-icon", createElement(SeparatorVertical)),
        );
        // Make the resize button show up over the sidebar and code editor
        resizeBorder.style.zIndex = "2";
        const editor2Root = div("shrink-0 row align-stretch overflow-hidden right-editor");
        root.replaceChildren(
            div("row align-stretch flex-1 shrink-1 h-0", [editor1Root, resizeBorder, editor2Root]),
        );

        // Add resizing support
        let isResizing = false;
        resizeBorder.addEventListener("mousedown", () => {
            // Prevent the resize from selecting a bunch of text
            root.style.userSelect = "none";
            isResizing = true;
            document.body.style.cursor = "col-resize";
        });
        document.addEventListener("mousemove", (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX; // distance from left edge
            editor1Root.style.width = `${newWidth}px`;
            // editor2Root.style.width = `${document.rootElement.clientWidth - newWidth}px`;
        });
        document.addEventListener("mouseup", () => {
            setTimeout(() => (root.style.userSelect = "initial"), 0);
            isResizing = false;
            document.body.style.cursor = "default";
        });

        // Add the questions element
        const comparisonContainerElem = div("justify-center row p-2 align-center p-4 shrink-0", []);
        root.appendChild(comparisonContainerElem);

        // On change, also check if the state has changed, and if so
        // update whether it lets you select the comparison. Also,
        // save the values to local storage
        const onChangeWrapped = () => {
            if (typeof this.grades === "undefined") return;

            localStorage.setItem(this.localStorageKey, JSON.stringify(this.grades));

            const showComparison =
                allowSkipping() ||
                (this.criteriaPage.isGroupGradeComplete(this.grades.group1, this.gradingInfo) &&
                    this.criteriaPage.isGroupGradeComplete(this.grades.group2, this.gradingInfo));

            if (showComparison && this.lastState !== "done") {
                this.lastState = "done";
                comparisonContainerElem.replaceChildren(
                    div("flex-1", div("", htmlEl(this.questionText()), {}, { maxWidth: "50vw" })),
                    multiButtonInput(
                        getSetField(this.grades, "comparison", () => onChangeWrapped()),
                        criteriaGradeOptionLabels(),
                        {
                            horizontal: true,
                            iconPos: "above",
                        },
                    ),
                );
            }
            if (!showComparison && this.lastState !== "notdone") {
                this.lastState = "notdone";
                comparisonContainerElem.replaceChildren(
                    div("flex-1", htmlEl(this.questionText())),
                    // div(
                    //     "has-text-danger border-1 border-current round-1 p-2 px-4",
                    //     `Complete the ${criteriaPage.title().toLowerCase()} grades for each group`,
                    // ),
                );
            }

            onChange(showComparison && this.grades.comparison !== null);
        };

        // Get the existing grades from localstorage
        const existingGradesSchema = z.object({
            comparison: z
                .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
                .nullable(),
            group1: criteriaPage.groupGradeSchema,
            group2: criteriaPage.groupGradeSchema,
        });
        const existingGradesJson = localStorage.getItem(this.localStorageKey);
        const existingGradesResult = existingGradesSchema.safeParse(
            existingGradesJson ? JSON.parse(existingGradesJson) : null,
        );
        const useExistingGrades = existingGradesResult.success;
        const existingGrades = existingGradesResult.data;
        if (existingGradesJson && !useExistingGrades) {
            //console.log(
            //    "Error parsing old answers:",
            //    existingGradesResult.error,
            //    JSON.parse(existingGradesJson),
            //);
        }

        const instructionText = gradingInfo.peerInstructions(criteriaPage.criteriaType);
        function makeTopLabel(group: 1 | 2): HTMLElement {
            return div("pb-3", [
                h3("text-center pb-2", `Implementation ${group}`),
                div("size-90", instructionText),
            ]);
        }
        // Create the sidebars, creating the grade objects in the process
        this.grades = {
            comparison: existingGradesResult.data?.comparison ?? null,
            group1: makeMetricsEditor<G>(
                editor1Root,
                this.group1Files,
                gradingInfo.fileGroupMethod(),
                (root, info) => {
                    const grades = useExistingGrades
                        ? (existingGrades.group1 as G)
                        : criteriaPage.createGroupGrade(info.metrics);
                    this.rerender1 = () =>
                        this.criteriaPage.makeSidebar(
                            gradingInfo,
                            root,
                            info,
                            onChangeWrapped,
                            grades,
                            makeTopLabel(1),
                            deps.group1,
                        );
                    return grades;
                },
            ),
            group2: makeMetricsEditor<G>(
                editor2Root,
                this.group2Files,
                gradingInfo.fileGroupMethod(),
                (root, info) => {
                    const grades = useExistingGrades
                        ? (existingGrades.group2 as G)
                        : criteriaPage.createGroupGrade(info.metrics);
                    this.rerender2 = () =>
                        this.criteriaPage.makeSidebar(
                            gradingInfo,
                            root,
                            info,
                            onChangeWrapped,
                            grades,
                            makeTopLabel(2),
                            deps.group2,
                        );
                    return grades;
                },
            ),
        };
        onChangeWrapped();
    }

    // Grading for this page is complete if the grading for both
    // groups is complete, and the comparison has been performed
    public isComplete(): boolean {
        return (
            this.grades.comparison !== null &&
            this.criteriaPage.isGroupGradeComplete(this.grades.group1, this.gradingInfo) &&
            this.criteriaPage.isGroupGradeComplete(this.grades.group2, this.gradingInfo)
        );
    }
}
