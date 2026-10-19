import { accordion } from "../../utils/accordion";
import { div, span } from "../../utils/elements";
import { button, getSetField, multiButtonInput, textInput } from "../../utils/inputs";
import { label } from "../../utils/typography";
import { compareModules, selectTab } from "../editor";
import { EditorWithMetrics, ProjectMetrics } from "../metrics";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import z from "zod";
import { alignedMetric, CriteriaPage, moduleContainer, percentFromCounts, todoIcon } from "./common";

const REQUIRE_MODULE_PURPOSE = false;

export const moduleGradeSchema = z.object({
    singleResponsibility: z.number().int().min(0).max(2).nullable(),
    text: z.string(),
});
export const modularityGradeSchema = z.object({ modules: z.record(z.string(), moduleGradeSchema) });

export type ModuleGrade = z.infer<typeof moduleGradeSchema>;
export type ModularityGrade = z.infer<typeof modularityGradeSchema>;

export function moduleGradeIsComplete(grade: ModuleGrade): boolean {
    return (
        grade.singleResponsibility === 1 ||
        grade.singleResponsibility === 2 ||
        (grade.singleResponsibility === 0 && (!REQUIRE_MODULE_PURPOSE || grade.text.length > 0))
    );
}

export class ModularityPage extends CriteriaPage<ModularityGrade> {
    public criteriaType: PeerGradingCriteriaType = "modularity";
    public groupGradeSchema = modularityGradeSchema;

    public isGroupGradeComplete(grade: ModularityGrade): boolean {
        for (const key in grade.modules) {
            if (!moduleGradeIsComplete(grade.modules[key])) return false;
        }
        return true;
    }

    public createGroupGrade(metrics: ProjectMetrics): ModularityGrade {
        return {
            modules: Object.fromEntries(
                Object.keys(metrics).map((name): [string, ModuleGrade] => [
                    name,
                    { singleResponsibility: null, text: "" },
                ]),
            ),
        };
    }

    public makeSidebar(
        gradingInfo: LanguageTerminology,
        root: HTMLElement,
        info: EditorWithMetrics,
        onChange: () => void,
        groupGrade: ModularityGrade,
        topLabel: HTMLElement,
        _dep: undefined,
    ) {
        const accordionKey = Math.floor(Math.random() * 1000000).toString();
        const moduleEntries = Object.entries(groupGrade.modules);
        moduleEntries.sort((a, b) => compareModules(a[0], b[0]));

        const summaryRoot = div("p-2");
        const summaryBox = div("round bg1 border-1 mb-4", [
            div("py-1 px-2 border-bottom bg3 has-text-weight-bold", "Summary"),
            summaryRoot,
        ]);
        const renderSummary = () => {
            const total = moduleEntries.length;
            const single = moduleEntries.filter(([, g]) => g.singleResponsibility === 0).length;
            summaryRoot.replaceChildren(
                alignedMetric("Modules with single responsibility", percentFromCounts(single, total)),
            );
        };
        renderSummary();

        root.replaceChildren(
            topLabel,
            summaryBox,
            ...moduleEntries.map(([modName, modGrade], modIdx) => {
                const todoIndicator = span("row align-center");
                const textContainer = div();

                let textBox: HTMLInputElement;
                const updateModElem = () => {
                    todoIndicator.replaceChildren(todoIcon(moduleGradeIsComplete(modGrade)));

                    const showText = REQUIRE_MODULE_PURPOSE && modGrade.singleResponsibility === 0;
                    textContainer.hidden = !showText;
                    if (showText) textBox.focus();

                    renderSummary();
                    onChange();
                };
                updateModElem();

                textBox = textInput(getSetField(modGrade, "text", updateModElem));
                textContainer.replaceChildren(label("What is the single responsibility?", textBox));
                textContainer.hidden = true;

                const containerContent = div("p-1", [
                    multiButtonInput(
                        getSetField(modGrade, "singleResponsibility", updateModElem),
                        [
                            [0, gradingInfo.moduleSRLabel("single"), div("size-150 has-text-success", "✓")],
                            [1, gradingInfo.moduleSRLabel("partial"), div("size-150 has-text-danger", "✗")],
                            [2, gradingInfo.moduleSRLabel("multiple"), div("size-150 has-text-danger", "✗")],
                        ],
                        {
                            className: "pb-2",
                            gap: 1,
                            horizontal: false,
                        },
                    ),
                    textContainer,
                ]);

                return moduleContainer({
                    groupMethod: info.groupMethod,
                    modName,
                    content: containerContent,
                    after: [],
                    right: todoIndicator,
                    wrapper: (h, b) =>
                        accordion(h, b, accordionKey, modIdx === 0, (open) => {
                            if (!open) return;
                            const tabIndex = info.tabbedEditor.tabs.findIndex(
                                (tab) => tab.mod === modName,
                            );
                            if (tabIndex !== -1) selectTab(info.tabbedEditor, tabIndex);
                        }),
                });
            }),
        );
    }
}

export class TaModularityPage extends ModularityPage {
    public criteriaType: PeerGradingCriteriaType = "modularity";

    public localstorageKey(): string {
        return "ta_modularity_or_decoupling";
    }
}
