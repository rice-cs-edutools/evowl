import * as cytoscape from "cytoscape";
import { accordion } from "../../utils/accordion";
import { div, ElementChild, span } from "../../utils/elements";
import { getSetField, multiButtonInput, textInput } from "../../utils/inputs";
import { label } from "../../utils/typography";
import { compareModules, selectTab } from "../editor";
import { EditorWithMetrics, packageAbbreviation, ProjectMetrics } from "../metrics";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import z from "zod";
import {
    CriteriaPage,
    moduleContainer,
    moduleLabel,
    searchableMetric,
    todoIcon,
} from "./common";
import {
    ModularityGrade,
    ModuleGrade,
    moduleGradeIsComplete,
    modularityGradeSchema,
} from "./modularity";
import { groupBy } from "../../utils/functions";

const REQUIRE_MODULE_PURPOSE = false;

function makeDependencyGraph(root: HTMLElement, metrics: ProjectMetrics): void {
    const modules = Object.entries(metrics);

    (cytoscape as any as { default: typeof cytoscape }).default({
        container: root,
        elements: [
            ...modules.map(([name, m]) => ({
                data: {
                    id: name.replace(/^[^/]+$/, "main").replace(/^[^/]+\//, ""),
                    size: Math.sqrt(m.LineCount) + 20,
                    color: "#88ccff",
                },
            })),
            ...modules.flatMap(([source, modMetrics]) => {
                const byModule = groupBy(modMetrics.ModuleImportUses, (a) => a.Name);
                return Object.entries(byModule)
                    .filter(([target]) => target in metrics)
                    .map(([target, uses]) => ({
                        data: {
                            source: source.replace(/^[^/]+$/, "main").replace(/^[^/]+\//, ""),
                            target: target.replace(/^[^/]+$/, "main").replace(/^[^/]+\//, ""),
                            width: Math.sqrt(uses.length * 3),
                        },
                    }));
            }),
        ],
        style: [
            {
                selector: "node",
                style: {
                    width: "data(size)",
                    height: "data(size)",
                    label: "data(id)",
                    "background-color": "data(color)",
                    color: "#333",
                    "text-valign": "center",
                    "font-size": 12,
                },
            },
            {
                selector: "edge",
                style: {
                    width: "data(width)",
                    "line-color": "#555",
                    "target-arrow-color": "#555",
                    "target-arrow-shape": "triangle",
                    "curve-style": "bezier",
                },
            },
        ],
        layout: { name: "cose", animate: true },
    });
}
if (1 + 1 === 3) makeDependencyGraph(null as any, null as any);

function decouplingModuleGrade(
    gradingInfo: LanguageTerminology,
    info: EditorWithMetrics,
    modName: string,
    modDep: ModuleGrade,
): [HTMLElement, HTMLElement[]] {
    const isMain = modName === "main";
    const modStats = info.metrics[modName];
    const importUses = [
        ...[...modStats.ExternalImportUses].sort((a, b) => a.Name.localeCompare(b.Name)),
        ...[...modStats.ModuleImportUses].sort((a, b) => a.Name.localeCompare(b.Name)),
    ];
    const dependencyElems = Object.entries(groupBy(importUses, (use) => use.Name)).map(
        ([dependency, locations]) =>
            div(
                "pl-4 overflow-x-auto",
                searchableMetric(
                    info,
                    locations,
                    moduleLabel(info.groupMethod, packageAbbreviation(dependency)),
                    locations.length,
                    dependency,
                    isMain ? "normal" : "error",
                ),
            ),
    );

    const isError = !isMain && dependencyElems.length > 0;
    let dependencyCountColor = isMain ? "dark" : isError ? "danger" : "success";
    let dependencyCountText = `${dependencyElems.length} dependenc${dependencyElems.length === 1 ? "y" : "ies"}`;
    const singleResp = modDep.singleResponsibility;
    if (singleResp === 1 || singleResp === 2) {
        dependencyCountColor = "danger";
        dependencyCountText = "Not modular";
        dependencyElems.push(
            div("size-90 has-text-danger", gradingInfo.cannotBeDecoupledMessage()),
        );
    }

    const dependencyCountLabel = div(
        `size-90 has-text-${dependencyCountColor} pr-2`,
        dependencyCountText,
    );
    return [dependencyCountLabel, dependencyElems];
}

export class DecouplingPage extends CriteriaPage<undefined, ModularityGrade> {
    public criteriaType: PeerGradingCriteriaType = "decoupling";
    public groupGradeSchema = z.undefined();

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
        _groupGrade: undefined,
        topLabel: HTMLElement,
        dep: ModularityGrade,
    ) {
        const sortedModules = Object.keys(info.metrics).sort(compareModules);
        const elems = sortedModules.map((modName) => {
            const [head, body] = decouplingModuleGrade(gradingInfo, info, modName, dep.modules[modName]);
            return moduleContainer({
                groupMethod: info.groupMethod,
                modName,
                content: body,
                right: head,
            });
        });
        root.replaceChildren(topLabel, ...elems);
    }
}

export class TaDecouplingPage extends CriteriaPage<ModularityGrade> {
    public criteriaType: PeerGradingCriteriaType = "decoupling";
    public groupGradeSchema = modularityGradeSchema;

    public localstorageKey(): string {
        return "ta_modularity_or_decoupling";
    }

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

        root.replaceChildren(
            topLabel,
            ...moduleEntries.map(([modName, modGrade], modIdx) => {
                const todoIndicator = span("row align-center gap-2");
                const textContainer = div();
                const decouplingContainer = div();

                let textBox: HTMLInputElement;
                const updateModElem = () => {
                    const [head, body] = decouplingModuleGrade(gradingInfo, info, modName, modGrade);
                    todoIndicator.replaceChildren(todoIcon(moduleGradeIsComplete(modGrade)));
                    decouplingContainer.replaceChildren(div("has-text-dark", "Imports:"), ...body);

                    const showText = REQUIRE_MODULE_PURPOSE && modGrade.singleResponsibility === 0;
                    textContainer.hidden = !showText;
                    if (showText) textBox.focus();

                    onChange();
                    return head;
                };
                let head = updateModElem();

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
                    decouplingContainer,
                ]);

                return moduleContainer({
                    groupMethod: info.groupMethod,
                    modName,
                    content: [head, containerContent],
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
