export type BuiltinPeerGradingCriteriaType =
    | "encapsulation"
    | "modularity"
    | "decoupling"
    | "clarity"
    | "robustness";

export type PeerGradingCriteriaType = BuiltinPeerGradingCriteriaType | (string & {});

export const BUILTIN_CRITERIA: BuiltinPeerGradingCriteriaType[] = [
    "encapsulation",
    "modularity",
    "decoupling",
    "clarity",
    "robustness",
];

export function detectCriteriaType(criterionText: string): {
    criteriaType: PeerGradingCriteriaType;
    title: string;
    question: string | null;
} {
    // Remove HTML tags and ampersands, then split into name and question.
    const stripped = criterionText.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    const colonIdx = stripped.indexOf(":");
    const namePart = colonIdx >= 0 ? stripped.substring(0, colonIdx).trim() : stripped;

    
    const questionPart = colonIdx >= 0 ? stripped.substring(colonIdx + 1).trim() : null;
    const lower = namePart.toLowerCase();
    const builtin = BUILTIN_CRITERIA.find((b) => lower.includes(b));
    const criteriaType: PeerGradingCriteriaType =
        builtin ?? lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { criteriaType, title: namePart, question: questionPart || null };
}

export abstract class LanguageTerminology {
    public constructor(
        private readonly criteriaQuestions: Record<string, string>,
        private readonly criteriaTitles: Record<string, string> = {},
    ) {}

    public criteriaTitle(type: PeerGradingCriteriaType): string {
        return (
            this.criteriaTitles[type] ??
            type
                .split(/[_-]+/)
                .map((part) => part[0].toUpperCase() + part.substring(1))
                .join(" ")
        );
    }

    public criteriaQuestion(type: PeerGradingCriteriaType): string {
        return (
            this.criteriaQuestions[type] ??
            `Which implementation is better with respect to ${this.criteriaTitle(type)}?`
        );
    }

    public abstract fileGroupMethod(): "metrics" | "directory";

    public abstract structLabel(capitalized?: boolean, plural?: boolean): string;
    public abstract functionLabel(capitalized?: boolean, plural?: boolean): string;

    public abstract peerInstructions(type: PeerGradingCriteriaType): string;
    public abstract taInstructions(type: PeerGradingCriteriaType): string;

    public abstract structPrefix(): string;
    public abstract functionPrefix(): string;
    public abstract showStructArgumentShouldBeInterface(): boolean;

    public abstract cannotBeDecoupledMessage(): string;
    public abstract moduleSRLabel(type: "single" | "multiple" | "partial"): string;
    public abstract functionSRLabel(type: "single" | "multiple" | "partial"): string;

    public abstract resolvedOrReturnedPercent(): string;
    public abstract resolvedNorReturnedCheckbox(): string;
}

export class GoOrTsLanguageTerminology extends LanguageTerminology {
    private isGo: boolean;
    constructor(
        language: "typescript" | "go",
        criteriaQuestions: Record<string, string>,
        criteriaTitles: Record<string, string> = {},
    ) {
        super(criteriaQuestions, criteriaTitles);
        this.isGo = language === "go";
    }

    public fileGroupMethod(): "metrics" | "directory" {
        return this.isGo ? "metrics" : "directory";
    }

    public structLabel(capitalized: boolean = false, plural: boolean = false): string {
        const lc = this.isGo ? (plural ? "structs" : "struct") : plural ? "types" : "type";
        return capitalized ? `${lc[0].toUpperCase()}${lc.substring(1)}` : lc;
    }

    public functionLabel(capitalized: boolean = false, plural: boolean = false): string {
        const lowercase = plural ? "functions" : "function";
        return capitalized ? `${lowercase[0].toUpperCase()}${lowercase.substring(1)}` : lowercase;
    }

    public structPrefix(): string {
        return this.isGo ? "struct" : "type";
    }

    public functionPrefix(): string {
        return this.isGo ? "func" : "function";
    }

    public showStructArgumentShouldBeInterface(): boolean {
        return this.isGo;
    }

    public peerInstructions(criteria: PeerGradingCriteriaType): string {
        const moduleName = this.isGo ? "package" : "module";
        const structName = this.structLabel();
        const funcName = this.functionLabel();

        switch (criteria) {
            case "encapsulation":
                return `Examine each ${funcName} and ${structName} in both implementations, and grade the encapsulation and clarity of each. Based on this information, indicate which group's submission is more encapsulated.`;
            case "modularity":
                return `Identify whether each ${moduleName} has a single responsibility. Based on this information, indicate which group's submission is more modular.`;
            case "decoupling":
                return `Look through each time a ${this.isGo ? "non-main " : ""}${moduleName} directly imports from another ${moduleName}. Also keep in mind that if a ${moduleName} has more than one responsibility, it cannot be decoupled. Then, indicate which group's submission is more decoupled.`;
            case "clarity":
                return ` Look at the breakdown of documentation quality that you selected on a previous page. Based on this information, indicate which group's submission has better clarity.`;
            case "robustness":
                return this.isGo
                    ? `Examine each time a ${funcName} returns an error, and indicate whether the error is properly checked, logged, and handled. Based on this information, indicate which group's submission is more robust.`
                    : `Examine each try-catch block and unhandled promise. Keep in mind that more catch blocks probably means that a submission is more robust. Then, indicate which submission is more robust.`;
            default:
                return `Review both implementations directly in the editor, then indicate which group's submission is better for ${this.criteriaTitle(criteria)}.`;
        }
    }

    public taInstructions(criteria: PeerGradingCriteriaType): string {
        const moduleName = this.isGo ? "package" : "module";
        const structName = this.structLabel();
        const funcName = this.functionLabel();

        switch (criteria) {
            case "encapsulation":
                return `Examine each ${funcName} and ${structName} in both implementations, and grade the encapsulation of each.`;
            case "modularity":
                return `Identify the whether each ${moduleName} has a single responsibility.`;
            case "decoupling":
                return `Look through each time a non-main ${moduleName} directly imports from another ${moduleName}. Also keep in mind that if a ${moduleName} has more than one responsibility, it cannot be decoupled.`;
            case "clarity":
                return ` Look at the breakdown of documentation quality that you selected on a previous page.`;
            case "robustness":
                return `Examine each time a ${funcName} returns an error, and indicate whether the error is properly checked, logged, and handled.`;
            default:
                return `Review the implementation directly in the editor and grade ${this.criteriaTitle(criteria)}.`;
        }
    }

    public cannotBeDecoupledMessage(): string {
        const moduleName = this.isGo ? "package" : "module";
        return `This ${moduleName} does not have a clear single responsibility, so it cannot be decoupled.`;
    }

    public moduleSRLabel(type: "single" | "multiple" | "partial"): string {
        const moduleName = this.isGo ? "package" : "module";
        switch (type) {
            case "single":
                return `The ${moduleName} has a clear single responsibility`;
            case "multiple":
                return `Part of the single responsibility is in another ${moduleName}`;
            case "partial":
                return `The ${moduleName} has more than one responsibility`;
        }
    }
    public functionSRLabel(type: "single" | "multiple" | "partial"): string {
        switch (type) {
            case "single":
                return "The function has a clear single responsibility";
            case "multiple":
                return "The function has more than one responsibility";
            case "partial":
                return "Part of the single responsibility is in another function";
        }
    }

    public resolvedOrReturnedPercent(): string {
        return this.isGo
            ? "Error is resolved or returned"
            : "Error is resolved, re-thrown, or re-rejected";
    }

    public resolvedNorReturnedCheckbox(): string {
        return this.isGo
            ? "Error is neither resolved nor returned"
            : "Error is neither resolved, re-thrown, nor re-rejected";
    }
}
