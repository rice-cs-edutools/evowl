import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Circle,
    CircleCheck,
    CircleDotDashed,
    createElement,
    FileCode,
    Folder,
    Globe,
    Home,
} from "lucide";
import { accordion, accordionCloseById, accordionOpen, AccordionInfo } from "../../utils/accordion";
import { button, getSetField } from "../../utils/inputs";
import { div, el, ElementChild, span } from "../../utils/elements";
import { h3 } from "../../utils/typography";
import { compareModules, selectTab } from "../editor";
import {
    CodeSegment,
    compareCodeLocations,
    EditorWithMetrics,
    metricSearchForward,
    ProjectMetrics,
    showCodeSegment,
} from "../metrics";
import { partition } from "../../utils/functions";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import z from "zod";

export abstract class CriteriaPage<G = undefined, D = undefined> {
    public abstract get criteriaType(): PeerGradingCriteriaType;

    public localstorageKey(): string {
        return this.criteriaType;
    }

    public abstract isGroupGradeComplete(grade: G, gi: LanguageTerminology): boolean;
    public abstract createGroupGrade(metrics: ProjectMetrics): G;
    public abstract groupGradeSchema: z.Schema;

    public abstract makeSidebar(
        gradingInfo: LanguageTerminology,
        root: HTMLElement,
        info: EditorWithMetrics,
        onChange: () => void,
        grade: G,
        topLabel: HTMLElement,
        dep: D,
    ): void;
}

export function makeActivityListByModule<G>(
    root: HTMLElement,
    info: EditorWithMetrics,
    topLabel: ElementChild,
    grades: G[],
    gradePlace: (seg: G) => CodeSegment,
    gradeIsComplete: (grade: G) => boolean,
    renderTitle: (grade: G) => ElementChild,
    renderGrade: (root: HTMLElement, grade: G, onUpdate: () => void) => void,
    renderFinalMetrics: (root: HTMLElement) => void,
    markGradeViewed?: (grade: G) => void,
) {
    if (grades.length === 0) {
        root.replaceChildren(
            div("flex-1 col justify-center align-center is-italic", "Nothing to grade"),
        );
        return;
    }

    root.style.padding = "0";
    const modulesContainer = div();
    modulesContainer.style.overflow = "auto";

    let openPlaceIndex = 0;
    const placeAccordions: [AccordionInfo, AccordionInfo][] = [];
    const currentIndexElem = div();

    const accordionKey = Math.floor(Math.random() * 1000000).toString();
    const accordionPlaceKey = accordionKey + "---place";

    const finalMetricsContainer = div();
    const generateFinalMetrics = () => renderFinalMetrics(finalMetricsContainer);

    function compareGrades(g1: G, g2: G): number {
        return compareCodeLocations(gradePlace(g1), gradePlace(g2));
    }

    const byModule = partition(grades, (g) =>
        info.groupMethod === "metrics"
            ? info.fileGroups.get(gradePlace(g).File)
            : gradePlace(g).File,
    );
    const byModuleEntries = Object.entries(byModule);
    byModuleEntries.sort((a, b) => compareModules(a[0], b[0]));

    for (const [modName, modGrades] of byModuleEntries) {
        modGrades.sort(compareGrades);
        const moduleGradesContainer = div("");

        const moduleTodoIndicator = div("pt-2");
        let moduleTodoIsChecked: boolean | null = null;
        const refreshModuleTodoIndicator = () => {
            const nowChecked = modGrades.every((grade) => gradeIsComplete(grade));
            if (moduleTodoIsChecked === nowChecked) return;

            moduleTodoIsChecked = nowChecked;
            moduleTodoIndicator.replaceChildren(todoIcon(nowChecked));
        };
        refreshModuleTodoIndicator();

        let moduleAccordionInfo: AccordionInfo;
        modulesContainer.appendChild(
            accordion(
                div("has-text-weight-bold py-1 row align-center gap-1", [
                    moduleTodoIndicator,
                    moduleLabel(info.groupMethod, modName),
                ]),
                moduleGradesContainer,
                accordionKey,
                false,
                (open) => {
                    if (!open) {
                        currentIndexElem.innerText = "-/" + placeAccordions.length;
                        accordionCloseById(accordionPlaceKey);
                        return;
                    }
                    const tabIndex = info.tabbedEditor.tabs.findIndex((tab) => tab.mod === modName);
                    if (tabIndex !== -1) {
                        selectTab(info.tabbedEditor, tabIndex);
                    }
                },
                (accordionInfo) => (moduleAccordionInfo = accordionInfo),
            ),
        );

        for (const grade of modGrades) {
            const place = gradePlace(grade);

            let placeTodoIsChecked = gradeIsComplete(grade);
            const placeTodoIndicator = div("pt-2", todoIcon(placeTodoIsChecked));
            const refreshPlaceTodoIndicator = () => {
                const nowChecked = gradeIsComplete(grade);
                if (placeTodoIsChecked === nowChecked) return;

                placeTodoIsChecked = nowChecked;
                placeTodoIndicator.replaceChildren(todoIcon(nowChecked));
                refreshModuleTodoIndicator();
            };

            const onUpdate = () => {
                generateFinalMetrics();
                refreshPlaceTodoIndicator();
            };
            const placeGradeElem = div("p-3 bg1 border-1 place-grade-content");
            renderGrade(placeGradeElem, grade, onUpdate);

            const thisFuncIndex = placeAccordions.length;
            const thisAccordionElem = accordion(
                div("pl-4 row align-center gap-1 place-grade-title", [
                    placeTodoIndicator,
                    renderTitle(grade),
                ]),
                placeGradeElem,
                accordionPlaceKey,
                false,
                (open) => {
                    if (open) {
                        if (markGradeViewed) {
                            markGradeViewed(grade);
                            onUpdate();
                        }

                        showCodeSegment(info, place, "normal");
                        openPlaceIndex = thisFuncIndex;
                        currentIndexElem.innerText = `${thisFuncIndex + 1}/${placeAccordions.length}`;
                        setTimeout(() => {
                            if (isFullyVisible(modulesContainer.parentElement, thisAccordionElem)) {
                                return;
                            }
                            thisAccordionElem.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                                inline: "nearest",
                            });
                        }, 300);
                    } else {
                        currentIndexElem.innerText = "-/" + placeAccordions.length;
                    }
                },
                (accordionInfo) => placeAccordions.push([moduleAccordionInfo, accordionInfo]),
            );
            thisAccordionElem.style.marginBottom = "4px";
            moduleGradesContainer.append(thisAccordionElem);
        }
    }

    generateFinalMetrics();

    const funcCount = placeAccordions.length;
    const focusAndOpenDelta = (increment: number) => {
        if (
            (increment === -1 && openPlaceIndex === 0) ||
            (increment === 1 && openPlaceIndex === funcCount - 1)
        ) {
            openPlaceIndex = -1;
            accordionCloseById(accordionKey);
            accordionCloseById(accordionPlaceKey);
            return;
        }

        if (openPlaceIndex === -1) {
            openPlaceIndex = increment === 1 ? 0 : funcCount - 1;
        } else {
            openPlaceIndex = (openPlaceIndex + increment + funcCount) % funcCount;
        }

        const [modAccordion, funcAccordion] = placeAccordions[openPlaceIndex];
        accordionOpen(modAccordion, true);
        accordionOpen(funcAccordion);
    };
    focusAndOpenDelta(0);

    const nextPrevBtnClass = "button has-background-primary-dark has-text-white round";
    const nextPrevBtns = div("border-top bg1 p-1 shrink-0", [
        div("row justify-between align-center gap-1", [
            button(nextPrevBtnClass, [createElement(ArrowLeft), "Previous"], () =>
                focusAndOpenDelta(-1),
            ),
            currentIndexElem,
            button(nextPrevBtnClass, ["Next", createElement(ArrowRight)], () =>
                focusAndOpenDelta(1),
            ),
        ]),
    ]);

    root.replaceChildren(
        div("h-100 col", [
            div("overflow-auto no-scrollbar h-0 flex-1 px-3", [
                topLabel,
                div("round bg1 border-1 mb-4", [
                    div("py-1 px-2 border-bottom bg3 has-text-weight-bold", "Summary"),
                    div("p-2", finalMetricsContainer),
                ]),
                modulesContainer,
            ]),
            nextPrevBtns,
        ]),
    );
}

function isFullyVisible(container: HTMLElement, element: HTMLElement) {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
}

export function moduleLabel(groupMethod: "metrics" | "directory", modName: string): HTMLElement {
    const isImported = modName.includes("/");
    const icon =
        groupMethod === "directory"
            ? FileCode
            : isImported
              ? Globe
              : modName === "main"
                ? Home
                : Folder;
    const iconElem = createElement(icon, { width: 20, height: 20 });
    return span("row align-center gap-1", [iconElem, modName]);
}

export function moduleContainer({
    groupMethod,
    modName,
    content,
    after,
    right,
    wrapper,
}: {
    groupMethod: "metrics" | "directory";
    modName: string;
    content: ElementChild;
    after?: ElementChild;
    right?: ElementChild;
    wrapper?: (h: ElementChild, b: ElementChild) => ElementChild;
}): HTMLElement {
    const isMain = modName === "main";
    const title = h3("pb-1", moduleLabel(groupMethod, modName));
    const withAfter = after ? div("row align-center", [title, after]) : title;
    const withRight = right
        ? div("row flex-1 justify-between align-center", [withAfter, right])
        : withAfter;
    const body = wrapper ? wrapper(withRight, content) : [withRight, content];
    return container(`p-3 size-95 ${isMain ? "main-module-container" : ""}`, body);
}

export function container(className?: string, child?: ElementChild): HTMLElement {
    return div(`bg1 border-1 round-1 p-1 ${className}`, child);
}

const todoStates = {
    false: [Circle, "#939799"],
    started: [CircleDotDashed, "orange"],
    true: [CircleCheck, "darkblue"],
} as const;

export function todoIcon(done: boolean | "started", size: number = 20) {
    const [icon, color] = todoStates[`${done}`];
    const elem = createElement(icon, {
        color: color,
        width: size,
        height: size,
    });
    elem.classList.add(`todo-done-${done}`);
    return elem;
}

export function percentFromCounts(
    correctCt: number,
    allCt: number,
    color: boolean = true,
): HTMLElement {
    if (allCt === 0) return div("", "N/A");
    if (allCt === correctCt) return div(color ? "has-text-success" : "", "100%");
    const pct = Math.floor((100 * correctCt) / allCt);
    return div(color ? (pct <= 50 ? "has-text-danger" : "has-text-dark") : "", pct + "%");
}

export function nestedMetrics(header: ElementChild, ...children: ElementChild[]): HTMLElement {
    return div("", [
        div("has-text-weight-semibold", header),
        el("div", "row align-stretch", [
            el("div", "metric-children-vline", []),
            el("div", "flex-1", children),
        ]),
    ]);
}

export function alignedMetric(title: ElementChild, value: ElementChild): HTMLElement {
    return el("div", "metric row justify-between align-center", [
        el("span", "metric-title", [title]),
        el("span", "metric-value", [value]),
    ]);
}

export function searchableMetric(
    info: EditorWithMetrics,
    locations: CodeSegment[],
    title: ElementChild,
    value: ElementChild,
    description?: string,
    metricType: "normal" | "warning" | "error" = "normal",
): HTMLElement {
    description = description ?? (typeof title === "string" ? title : "");
    const color = "dark";
    const disabled = locations.length === 0;
    const searchButton = (backward: boolean) =>
        div(
            `${disabled ? "" : "pointer"} pt-2`,
            createElement(backward ? ChevronUp : ChevronDown, {
                height: 20,
                color: disabled ? "lightgray" : undefined,
            }),
            {
                onclick: disabled
                    ? undefined
                    : () => metricSearchForward(info, locations, description, metricType, backward),
            },
        );

    return alignedMetric(
        div("pl-2", [title]),
        div(`row align-center gap-1 has-text-${color}`, [
            span("pt-1", value),
            searchButton(true),
            searchButton(false),
        ]),
    );
}
