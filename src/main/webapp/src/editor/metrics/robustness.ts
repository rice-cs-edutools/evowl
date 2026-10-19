import { div, span } from "../../utils/elements";
import { checkboxInput, getSetField, multiButtonInput } from "../../utils/inputs";
import { CodeLocationSchema, CodeSegment, EditorWithMetrics, ProjectMetrics } from "../metrics";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import z from "zod";
import {
    alignedMetric,
    CriteriaPage,
    makeActivityListByModule,
    percentFromCounts,
} from "./common";

export const errorCallGradeSchema = z.object({
    location: CodeLocationSchema,
    graderHasViewed: z.boolean(),
    checked: z.boolean(),
    poorlyNamed: z.boolean(),
    notLogged: z.boolean(),
    failsToResolveOrReturn: z.boolean(),
    noneOfTheAbove: z.boolean(),
});
export const robustnessGradeSchema = z.object({ errorCalls: z.array(errorCallGradeSchema) });

export type ErrorCallGrade = z.infer<typeof errorCallGradeSchema>;
export type RobustnessGrade = z.infer<typeof robustnessGradeSchema>;

export function errorCallGradeIsComplete(grade: ErrorCallGrade): boolean {
    if (!grade.graderHasViewed) return false;
    if (!grade.checked) return true;
    return (
        grade.poorlyNamed || grade.notLogged || grade.failsToResolveOrReturn || grade.noneOfTheAbove
    );
}

export class RobustnessPage extends CriteriaPage<RobustnessGrade> {
    public criteriaType: PeerGradingCriteriaType = "robustness";
    public groupGradeSchema = robustnessGradeSchema;

    public isGroupGradeComplete(grade: RobustnessGrade): boolean {
        return grade.errorCalls.every((item) => errorCallGradeIsComplete(item));
    }

    public createGroupGrade(metrics: ProjectMetrics): RobustnessGrade {
        function makeErrorCallGrade(place: CodeSegment, checked: boolean): ErrorCallGrade {
            return {
                location: place,
                graderHasViewed: false,
                checked: checked,
                failsToResolveOrReturn: false,
                notLogged: false,
                poorlyNamed: false,
                noneOfTheAbove: false,
            };
        }

        return {
            errorCalls: [
                ...Object.values(metrics).flatMap((mod) =>
                    mod.MissingErrorChecks.map((seg) => makeErrorCallGrade(seg, false)),
                ),
                ...Object.values(metrics).flatMap((mod) =>
                    mod.MisnamedErrorChecks.map((seg) => makeErrorCallGrade(seg, true)),
                ),
                ...Object.values(metrics).flatMap((mod) =>
                    mod.ErrorChecks.map((seg) => makeErrorCallGrade(seg, true)),
                ),
            ],
        };
    }

    public makeSidebar(
        gradingInfo: LanguageTerminology,
        root: HTMLElement,
        info: EditorWithMetrics,
        onChange: () => void,
        groupGrades: RobustnessGrade,
        topLabel: HTMLElement,
        _dep: undefined,
    ): void {
        function render(renderRoot: HTMLElement, grade: ErrorCallGrade, onUpdate: () => void) {
            const anyOfTheAbove =
                grade.failsToResolveOrReturn || grade.notLogged || grade.poorlyNamed;
            if (anyOfTheAbove && grade.checked) grade.noneOfTheAbove = false;
            if (!grade.checked) {
                grade.noneOfTheAbove = false;
                grade.poorlyNamed = false;
                grade.notLogged = false;
                grade.failsToResolveOrReturn = false;
            }

            const rerender = () => {
                onUpdate();
                render(renderRoot, grade, onUpdate);
            };

            const onlyIfCheckedElem = div("col gap-1 pt-2", [
                checkboxInput(getSetField(grade, "notLogged", rerender), "Error is not logged", {
                    disabled: grade.noneOfTheAbove,
                }),
                checkboxInput(
                    getSetField(grade, "poorlyNamed", rerender),
                    "Error variable is poorly named",
                    { disabled: grade.noneOfTheAbove },
                ),
                checkboxInput(
                    getSetField(grade, "failsToResolveOrReturn", rerender),
                    gradingInfo.resolvedNorReturnedCheckbox(),
                    { disabled: grade.noneOfTheAbove },
                ),
                checkboxInput(getSetField(grade, "noneOfTheAbove", rerender), "None of the above", {
                    disabled: anyOfTheAbove,
                }),
            ]);

            renderRoot.replaceChildren(
                div("row align-center justify-between", [
                    "Is the error checked?",
                    multiButtonInput(
                        getSetField(grade, "checked", rerender),
                        [
                            [false, "No", span("has-text-danger", "✗")],
                            [true, "Yes", span("has-text-success", "✓")],
                        ],
                        { horizontal: true, gap: 0, padding: 1 },
                    ),
                ]),
                grade.checked ? onlyIfCheckedElem : "",
            );
        }

        function renderSummary(summaryRoot: HTMLElement) {
            onChange();
            const grades = groupGrades.errorCalls;
            const checkedGrades = grades.filter((g) => g.checked && g.graderHasViewed);
            summaryRoot.replaceChildren(
                alignedMetric("Error is checked", percentFromCounts(checkedGrades.length, grades.length)),
                div("text-center", "Of errors that are checked:"),
                alignedMetric(
                    "Error variable is well named",
                    percentFromCounts(
                        checkedGrades.filter((grade) => !grade.poorlyNamed).length,
                        checkedGrades.length,
                    ),
                ),
                alignedMetric(
                    "Error is logged",
                    percentFromCounts(
                        checkedGrades.filter((grade) => !grade.notLogged).length,
                        checkedGrades.length,
                    ),
                ),
                alignedMetric(
                    gradingInfo.resolvedOrReturnedPercent(),
                    percentFromCounts(
                        checkedGrades.filter((grade) => !grade.failsToResolveOrReturn).length,
                        checkedGrades.length,
                    ),
                ),
            );
        }

        makeActivityListByModule<ErrorCallGrade>(
            root,
            info,
            topLabel,
            groupGrades.errorCalls,
            (g) => g.location,
            errorCallGradeIsComplete,
            (g) => {
                const split = g.location.File.split("/");
                return `Line ${g.location.StartLine} of ${split[split.length - 1]}`;
            },
            render,
            renderSummary,
            (grade) => (grade.graderHasViewed = true),
        );
    }
}

export class TaRobustnessPage extends RobustnessPage {
    public criteriaType: PeerGradingCriteriaType = "robustness";
}
