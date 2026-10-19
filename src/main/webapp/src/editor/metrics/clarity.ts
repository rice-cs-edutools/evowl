import { div, el, ElementChild } from "../../utils/elements";
import { getSetField, multiButtonInput } from "../../utils/inputs";
import { EditorWithMetrics, NamedCodeSegment, NamedLocationMetric, ProjectMetrics } from "../metrics";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import { FuncGrade, FuncStructGrade, FuncStructGrades, funcStructGradesSchema, StructGrade } from "./encapsulation";
import {
    alignedMetric,
    container,
    CriteriaPage,
    makeActivityListByModule,
    nestedMetrics,
    percentFromCounts,
    searchableMetric,
} from "./common";

export class ClarityPage extends CriteriaPage<undefined, FuncStructGrades> {
    public criteriaType: PeerGradingCriteriaType = "clarity";
    public groupGradeSchema = funcStructGradesSchema;

    public isGroupGradeComplete(_grade: undefined): boolean {
        return true;
    }

    public createGroupGrade(_metrics: ProjectMetrics): undefined {
        return undefined;
    }

    public makeSidebar(
        gradingInfo: LanguageTerminology,
        root: HTMLElement,
        info: EditorWithMetrics,
        _onChange: () => void,
        _grade: undefined,
        topLabel: HTMLElement,
        dep: FuncStructGrades,
    ): void {
        const allFuncs = dep.grades.filter((g) => g.type === "function" && g.docQuality !== null);
        const allStructs = dep.grades.filter((g) => g.type === "struct" && g.docQuality !== null);

        function docQualityMetric(
            grades: FuncStructGrade[],
            q: FuncStructGrade["docQuality"],
            title: string,
        ): ElementChild {
            const gs = grades.flatMap((g) => (g.docQuality === q ? [g.location] : []));
            const percent = percentFromCounts(gs.length, grades.length, false);
            return searchableMetric(info, gs, title, div("row gap-2", [percent, gs.length]));
        }

        const dashedLine = () => el("div", "metric-border", []);
        root.replaceChildren(
            topLabel,
            ...[
                [`${gradingInfo.functionLabel(true)} Documentation`, allFuncs] as const,
                [`${gradingInfo.structLabel(true)} Documentation`, allStructs] as const,
            ].map(([title, grades]) =>
                container(
                    "p-3",
                    nestedMetrics(
                        alignedMetric(title, ""),
                        docQualityMetric(grades, "N/A", "Missing"),
                        dashedLine(),
                        docQualityMetric(grades, "bad", "Not at all clear"),
                        dashedLine(),
                        docQualityMetric(grades, "medium", "Somewhat clear"),
                        dashedLine(),
                        docQualityMetric(grades, "good", "Very clear"),
                    ),
                ),
            ),
        );
    }
}

export class TaClarityPage extends CriteriaPage<FuncStructGrades, undefined> {
    public criteriaType: PeerGradingCriteriaType = "clarity";
    public groupGradeSchema = funcStructGradesSchema;

    public isGroupGradeComplete(grade: FuncStructGrades): boolean {
        for (const funcStructGrade of grade.grades) {
            if (funcStructGrade.docQuality === null) return false;
        }
        return true;
    }

    public createGroupGrade(metrics: ProjectMetrics): FuncStructGrades {
        function makeFuncGrade(where: NamedCodeSegment, doc: boolean): FuncStructGrade {
            return {
                type: "function",
                location: where,
                singleResponsibility: null,
                structArgShouldBeInterface: null,
                docQuality: doc ? null : "N/A",
                shouldBePrivate: where.Name.match(/^[A-Z]/) ? null : "N/A",
            };
        }

        function makeStructGrade(where: NamedCodeSegment, doc: boolean): FuncStructGrade {
            const isPublic = where.Name.match(/^[A-Z]/);
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
        function generateFinalMetrics(summaryRoot: HTMLElement) {
            onChange();

            const grades = groupGrade.grades;
            const allFuncs = grades.filter((g) => g.type === "function" && g.docQuality !== null);
            const allStructs = grades.filter((g) => g.type === "struct" && g.docQuality !== null);

            function docQualityMetric(
                items: FuncStructGrade[],
                q: FuncStructGrade["docQuality"],
                title: string,
            ): ElementChild {
                const locations = items.flatMap((g) => (g.docQuality === q ? [g.location] : []));
                const percent = percentFromCounts(locations.length, items.length, false);
                return searchableMetric(
                    info,
                    locations,
                    title,
                    div("row gap-2", [percent, locations.length]),
                );
            }

            const dashedLine = () => el("div", "metric-border", []);
            summaryRoot.replaceChildren(
                topLabel,
                ...[
                    [`${gradingInfo.functionLabel(true)} Documentation`, allFuncs] as const,
                    [`${gradingInfo.structLabel(true)} Documentation`, allStructs] as const,
                ].map(([title, items]) =>
                    container(
                        "p-3",
                        nestedMetrics(
                            alignedMetric(title, ""),
                            docQualityMetric(items, "N/A", "Missing"),
                            dashedLine(),
                            docQualityMetric(items, "bad", "Not at all clear"),
                            dashedLine(),
                            docQualityMetric(items, "medium", "Somewhat clear"),
                            dashedLine(),
                            docQualityMetric(items, "good", "Very clear"),
                        ),
                    ),
                ),
            );
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
                div("col gap-2 size-90", [div("col gap-1", [docQualityGrade(grade, onUpdate)])]),
            );
        }

        function renderFuncGrade(renderRoot: HTMLElement, funcGrade: FuncGrade, onUpdate: () => void) {
            renderRoot.replaceChildren(div("col gap-2 size-90", [docQualityGrade(funcGrade, onUpdate)]));
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
            (grade) => grade.docQuality !== null,
            (g) =>
                `${g.type === "struct" ? gradingInfo.structPrefix() : gradingInfo.functionPrefix()} ${g.location.Name}`,
            render,
            generateFinalMetrics,
        );
    }
}
