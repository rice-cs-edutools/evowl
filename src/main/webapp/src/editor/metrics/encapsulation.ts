import { div, ElementChild, span } from "../../utils/elements";
import { getSetField, multiButtonInput } from "../../utils/inputs";
import { CodeLocationSchema, CodeSegment, EditorWithMetrics, NamedCodeLocationSchema, NamedCodeSegment, NamedLocationMetric, ProjectMetrics } from "../metrics";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import z from "zod";
import {
    alignedMetric,
    CriteriaPage,
    makeActivityListByModule,
    percentFromCounts,
} from "./common";

export const funcStructGradeSchema = z.union([
    z.object({
        type: z.literal("struct"),
        location: NamedCodeLocationSchema,
        shouldBePrivate: z.union([z.boolean(), z.literal("N/A")]).nullable(),
        docQuality: z.enum(["bad", "medium", "good", "N/A"]).nullable(),
    }),
    z.object({
        type: z.literal("function"),
        location: NamedCodeLocationSchema,
        singleResponsibility: z.number().int().min(0).max(2).nullable(),
        structArgShouldBeInterface: z.boolean().nullable(),
        shouldBePrivate: z.union([z.boolean(), z.literal("N/A")]).nullable(),
        docQuality: z.enum(["bad", "medium", "good", "N/A"]).nullable(),
    }),
]);
export const funcStructGradesSchema = z.object({ grades: z.array(funcStructGradeSchema) });

export type FuncStructGrade = z.infer<typeof funcStructGradeSchema>;
export type FuncGrade = Extract<FuncStructGrade, { type: "function" }>;
export type StructGrade = Extract<FuncStructGrade, { type: "struct" }>;
export type FuncStructGrades = z.infer<typeof funcStructGradesSchema>;

export function functionGradeIsComplete(grade: FuncGrade, gradingInfo: LanguageTerminology): boolean {
    const showSASBI = gradingInfo.showStructArgumentShouldBeInterface();
    return (
        grade.singleResponsibility !== null &&
        (!showSASBI || grade.structArgShouldBeInterface !== null) &&
        grade.shouldBePrivate !== null &&
        grade.docQuality !== null
    );
}

export function structGradeIsComplete(grade: StructGrade): boolean {
    return grade.shouldBePrivate !== null && grade.docQuality !== null;
}

function makeFuncStructSidebar(
    gradingInfo: LanguageTerminology,
    root: HTMLElement,
    info: EditorWithMetrics,
    groupGrade: FuncStructGrades,
    topLabel: HTMLElement,
    onChange: () => void,
): void {
    function generateFinalMetrics(summaryRoot: HTMLElement) {
        onChange();
        const doneFuncGrades = groupGrade.grades.filter(
            (g): g is FuncGrade => g.type === "function" && functionGradeIsComplete(g, gradingInfo),
        );
        const doneStructGrades = groupGrade.grades.filter(
            (g): g is StructGrade => g.type === "struct" && structGradeIsComplete(g),
        );

        summaryRoot.replaceChildren(
            alignedMetric(
                "Functions with single responsibility",
                percentFromCounts(
                    doneFuncGrades.filter((grade) => grade.singleResponsibility === 0).length,
                    doneFuncGrades.length,
                ),
            ),
            gradingInfo.showStructArgumentShouldBeInterface()
                ? alignedMetric(
                      "Correct use of interfaces",
                      percentFromCounts(
                          doneFuncGrades.filter(
                              (grade) => grade.structArgShouldBeInterface === false,
                          ).length,
                          doneFuncGrades.length,
                      ),
                  )
                : span(),
            alignedMetric(
                `Public ${gradingInfo.functionLabel(false, true)} are justified`,
                percentFromCounts(
                    doneFuncGrades.filter((grade) => grade.shouldBePrivate === false).length,
                    doneFuncGrades.length,
                ),
            ),
            alignedMetric(
                `Public ${gradingInfo.structLabel(false, true)} are justified`,
                percentFromCounts(
                    doneStructGrades.filter((grade) => grade.shouldBePrivate === false).length,
                    doneStructGrades.length,
                ),
            ),
        );
    }

    function shouldBePrivateGrade(grade: FuncStructGrade, onUpdate: () => void): ElementChild {
        return grade.shouldBePrivate === "N/A"
            ? []
            : div("col gap-1", [
                  `Should this ${grade.type === "struct" ? gradingInfo.structLabel() : gradingInfo.functionLabel()} be private?`,
                  multiButtonInput(
                      getSetField(grade, "shouldBePrivate", onUpdate),
                      [
                          [false, "No", null],
                          [true, "Yes", null],
                      ],
                      { horizontal: true },
                  ),
              ]);
    }

    function docQualityGrade(grade: FuncStructGrade, onUpdate: () => void): ElementChild {
        return grade.docQuality === "N/A"
            ? div("has-text-danger", "Documentation is missing.")
            : div("col gap-1", [
                  "How clear is the documentation?",
                  multiButtonInput(
                      getSetField(grade, "docQuality", onUpdate),
                      [
                          ["bad", "Not at all", null],
                          ["medium", "Somewhat", null],
                          ["good", "Very", null],
                      ],
                      { horizontal: true },
                  ),
              ]);
    }

    function renderStructGrade(renderRoot: HTMLElement, grade: StructGrade, onUpdate: () => void) {
        renderRoot.replaceChildren(
            div("col gap-2 size-90", [
                div("col gap-1", [shouldBePrivateGrade(grade, onUpdate), docQualityGrade(grade, onUpdate)]),
            ]),
        );
    }

    function renderFuncGrade(renderRoot: HTMLElement, funcGrade: FuncGrade, onUpdate: () => void) {
        renderRoot.replaceChildren(
            div("col gap-2 size-90", [
                div("col gap-1", [
                    "Single Responsibility",
                    multiButtonInput(
                        getSetField(funcGrade, "singleResponsibility", onUpdate),
                        [
                            [0, gradingInfo.functionSRLabel("single"), div("size-150 has-text-success", "✓")],
                            [1, gradingInfo.functionSRLabel("partial"), div("size-150 has-text-danger", "✗")],
                            [2, gradingInfo.functionSRLabel("multiple"), div("size-150 has-text-danger", "✗")],
                        ],
                        { horizontal: false },
                    ),
                ]),
                gradingInfo.showStructArgumentShouldBeInterface()
                    ? div("col gap-1", [
                          `Does this function have a ${gradingInfo.structLabel()} argument that should be an interface?`,
                          multiButtonInput(
                              getSetField(funcGrade, "structArgShouldBeInterface", onUpdate),
                              [
                                  [false, "No", null],
                                  [true, "Yes", null],
                              ],
                              { horizontal: true },
                          ),
                      ])
                    : span(),
                shouldBePrivateGrade(funcGrade, onUpdate),
                docQualityGrade(funcGrade, onUpdate),
            ]),
        );
    }

    const render = (renderRoot: HTMLElement, grade: FuncStructGrade, onUpdate: () => void) => {
        if (grade.type === "function") {
            renderFuncGrade(renderRoot, grade, onUpdate);
        } else {
            renderStructGrade(renderRoot, grade, onUpdate);
        }
    };

    makeActivityListByModule<FuncStructGrade>(
        root,
        info,
        topLabel,
        groupGrade.grades,
        (g) => g.location,
        (g) => (g.type === "function" ? functionGradeIsComplete(g, gradingInfo) : structGradeIsComplete(g)),
        (g) =>
            `${g.type === "struct" ? gradingInfo.structPrefix() : gradingInfo.functionPrefix()} ${g.location.Name}`,
        render,
        generateFinalMetrics,
    );
}

function locationUniqueId(location: CodeSegment): string {
    return `${location.File}:${location.StartLine}:${location.StartCol}`;
}

export class EncapsulationPage extends CriteriaPage<FuncStructGrades> {
    public criteriaType: PeerGradingCriteriaType = "encapsulation";
    public groupGradeSchema = funcStructGradesSchema;

    public isGroupGradeComplete(grade: FuncStructGrades, gradingInfo: LanguageTerminology): boolean {
        for (const funcStructGrade of grade.grades) {
            if (funcStructGrade.type === "function") {
                if (!functionGradeIsComplete(funcStructGrade, gradingInfo)) return false;
            } else if (!structGradeIsComplete(funcStructGrade)) {
                return false;
            }
        }
        return true;
    }

    public createGroupGrade(metrics: ProjectMetrics): FuncStructGrades {
        const publicFuncs = new Set(
            Object.values(metrics).flatMap((mod) => mod.PublicFuncs.map(locationUniqueId)),
        );
        const publicStructs = new Set(
            Object.values(metrics).flatMap((mod) => mod.PublicStructs.map(locationUniqueId)),
        );

        function makeFuncGrade(where: NamedCodeSegment, doc: boolean): FuncStructGrade {
            const isPublic = publicFuncs.has(locationUniqueId(where));
            return {
                type: "function",
                location: where,
                singleResponsibility: null,
                structArgShouldBeInterface: null,
                docQuality: doc ? null : "N/A",
                shouldBePrivate: isPublic ? null : "N/A",
            };
        }

        function makeStructGrade(where: NamedCodeSegment, doc: boolean): FuncStructGrade {
            const isPublic = publicStructs.has(locationUniqueId(where));
            return {
                type: "struct",
                location: where,
                docQuality: doc ? null : "N/A",
                shouldBePrivate: isPublic ? null : "N/A",
            };
        }

        function all(metric: NamedLocationMetric): NamedCodeSegment[] {
            return Object.values(metrics).flatMap((mod) => mod[metric]);
        }

        return {
            grades: [
                ...all("DocFuncs").map((func) => makeFuncGrade(func, true)),
                ...all("NodocFuncs").map((func) => makeFuncGrade(func, false)),
                ...all("DocStructs").map((struct) => makeStructGrade(struct, true)),
                ...all("NodocStructs").map((struct) => makeStructGrade(struct, false)),
            ],
        };
    }

    public makeSidebar(
        gradingInfo: LanguageTerminology,
        root: HTMLElement,
        info: EditorWithMetrics,
        onChange: () => void,
        groupGrade: FuncStructGrades,
        topLabel: HTMLElement,
        _dep: undefined,
    ): void {
        makeFuncStructSidebar(gradingInfo, root, info, groupGrade, topLabel, onChange);
    }
}

export class TaEncapsulationPage extends EncapsulationPage {
    public criteriaType: PeerGradingCriteriaType = "encapsulation";

    public createGroupGrade(metrics: ProjectMetrics): FuncStructGrades {
        const parentGrades = super.createGroupGrade(metrics);
        for (const grade of parentGrades.grades) {
            grade.docQuality = "N/A";
        }
        return parentGrades;
    }
}
