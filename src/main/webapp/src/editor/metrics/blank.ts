import { div } from "../../utils/elements";
import { EditorWithMetrics, ProjectMetrics } from "../metrics";
import { PeerGradingCriteriaType, LanguageTerminology } from "../peerGradingInfo";
import { container, CriteriaPage } from "./common";
import z from "zod";

export type BlankMetricsPageInfo = {
    criteriaType: PeerGradingCriteriaType;
    title: string;
    peerInstructions?: string;
    taInstructions?: string;
};

export class BlankPage extends CriteriaPage<null> {
    public readonly criteriaType: PeerGradingCriteriaType;
    public readonly groupGradeSchema = z.null();

    public constructor(private readonly pageInfo: BlankMetricsPageInfo) {
        super();
        this.criteriaType = pageInfo.criteriaType;
    }

    public isGroupGradeComplete(_grade: null): boolean {
        return true;
    }

    public createGroupGrade(_metrics: ProjectMetrics): null {
        return null;
    }

    public makeSidebar(
        _gradingInfo: LanguageTerminology,
        root: HTMLElement,
        _info: EditorWithMetrics,
        _onChange: () => void,
        _grade: null,
        topLabel: HTMLElement,
        _dep: undefined,
    ): void {
        root.replaceChildren(
            div("h-100 col", [
                div("overflow-auto no-scrollbar h-0 flex-1 px-3", [
                    topLabel,
                    container(
                        "p-3 size-95",
                        div(
                            "size-90",
                            "No automated metrics are available for this criterion. Review the code directly in the editor, then select the better implementation below.",
                        ),
                    ),
                ]),
            ]),
        );
    }
}
