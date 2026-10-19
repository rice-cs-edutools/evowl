import * as monaco from "monaco-editor";
import { makePeerGradingPage, makeTaInterface } from "./src/editor/peerGrading";
import { GoOrTsLanguageTerminology, detectCriteriaType } from "./src/editor/peerGradingInfo";
import { createTabbedEditor } from "./src/editor/editor";
import { makeInstructorDashboard } from "./src/instructor/dashboard";

// Import all css files
import "./css/bulma.css";

// Number of seconds the student has to wait after reading the training feedback
const trainingFeedbackWaitTime = 30;

// Error message shown when the server connection is lost
const CONNECTIVITY_ERROR_MSG =
    "The connection to the server has been lost. You will need to reload this page before continuing. Please make sure to save your answers to any free response questions locally (<i>e.g.</i> copy them into a text file on your computer) before refreshing, as those will not be saved in your browser. Your other progress will be saved and restored upon refresh.<br>";

// Error message shown when an unexpected error occurs loading the page
const GENERIC_ERROR_MSG =
    "Something went wrong when loading the page. You will need to reload this page before continuing. Please make sure to save your answers to any free response questions locally (<i>e.g.</i> copy them into a text file on your computer) before refreshing, as those will not be saved in your browser. Your other progress will be saved and restored upon refresh.<br>";

// Comparator for sorting files by name
const sortByFileName = (a: [string, ...unknown[]], b: [string, ...unknown[]]): number => {
    if (a[0] < b[0]) {
        return -1;
    } else if (a[0] > b[0]) {
        return 1;
    } else {
        return 0;
    }
};

let editor0: monaco.editor.IStandaloneCodeEditor;
let editor1: monaco.editor.IStandaloneCodeEditor;
let editor2: monaco.editor.IStandaloneCodeEditor;
let scrollMap0: Map<string, number> = new Map();
let scrollMap1: Map<string, number> = new Map();
let scrollMap2: Map<string, number> = new Map();
let userId: string;
let role: string;
let theFiles: Record<string, [string, string][]>;
let theQuestions: string[][];
let correctness: number[];
let studentAnswers: number[];
let radioButtons: string[];
let uniqueID: string;
let type: string;
let prevData: { type: string } = { type: "none" };
let totalPeerEvals: number;
let totalEvals: number;
let peerEvalIdx: number;
let instructorEvalIdx: number;
let trainingIdx: number;
let continueEnabled: boolean = false;
// submitButton is module-scoped so submitContinueButtonPress can access it
let submitButton: HTMLElement;

let taMetricGrades: unknown = null;
let peerGroupGrades: unknown = null;

// Tell the window to run the initialization code as soon as the HTML document is loaded
window.onload = init;
window.onbeforeunload = handleWindowUnload;

declare const __FETCH_ENDPOINT__: string;
const fetchEndpoint = __FETCH_ENDPOINT__;

// ----------
// HELPERS
// ----------

// Scroll to top and display a connectivity error in the #connectivity element
function showConnectivityError(msg: string): void {
    window.scrollTo(0, 0);
    document.getElementById("connectivity")!.innerHTML = msg;
}

// Create a Monaco editor in the given container with default read-only settings
function createMonacoEditor(containerId: string): monaco.editor.IStandaloneCodeEditor {
    return monaco.editor.create(document.getElementById(containerId)!, {
        value: [
            "package main",
            'import "fmt"',
            "func main() {",
            '\tfmt.Println("hello world")',
            "}",
        ].join("\n"),
        language: "typescript",
        minimap: { enabled: false },
        renderLineHighlight: "none",
        showDeprecated: false,
        readOnly: true,
        folding: false,
    });
}

// Resize a single Monaco editor to fit its parent element
function refreshEditor(editor: monaco.editor.IStandaloneCodeEditor, parentElem: HTMLElement): void {
    editor.layout({ width: 0, height: 0 });
    window.requestAnimationFrame(() => {
        const rect = parentElem.getBoundingClientRect();
        editor.layout({ width: rect.width * 0.95, height: rect.height * 0.85 });
    });
}

// Build tab UI for a submission panel, setting the first file active with language detection
function setupSubmissionTabs(
    files: [string, string][],
    editor: monaco.editor.IStandaloneCodeEditor,
    scrollMap: Map<string, number>,
    panelId: string,
    index: number,
): void {
    const filteredFiles = files.filter(([name]) => name !== "metrics.json" && name !== "go.mod");
    filteredFiles.sort(sortByFileName);
    const submissionFiles = document.getElementById(panelId)!;
    for (let i = 0; i < filteredFiles.length; i++) {
        const tab = document.createElement("li");
        tab.id = index + "Tab" + filteredFiles[i][0];
        const fileName = document.createElement("a");
        fileName.innerHTML = filteredFiles[i][0];
        fileName.id = index + "File" + filteredFiles[i][0];
        if (i === 0) {
            tab.classList.add("is-active");
            editor.setScrollPosition({ scrollTop: 0 });
            editor.getModel()!.setValue(filteredFiles[i][1]);
            if (filteredFiles[i][0].includes(".css")) {
                monaco.editor.setModelLanguage(editor.getModel()!, "css");
            } else if (filteredFiles[i][0].includes(".html")) {
                monaco.editor.setModelLanguage(editor.getModel()!, "html");
            } else {
                monaco.editor.setModelLanguage(editor.getModel()!, "typescript");
            }
        }
        scrollMap.set(filteredFiles[i][0], 0);
        tab.appendChild(fileName);
        tab.addEventListener("click", openFile);
        submissionFiles.appendChild(tab);
    }
}

// Append radio-button rows to the given table for each question; returns updated mcCounter
function addRadioRows(questions: string[], tableId: string, mcCounter: number): number {
    const multipleChoiceTable = document.getElementById(tableId)!;
    const numCols = 5;
    for (let i = 0; i < questions.length; i++) {
        const row = document.createElement("tr");
        const text = document.createElement("td");
        text.innerHTML = questions[i];
        row.appendChild(text);
        multipleChoiceTable.appendChild(row);
        for (let j = 0; j < numCols; j++) {
            const cell = document.createElement("td");
            (cell as any).name = "choice" + mcCounter.toString() + "cell";
            const button = document.createElement("input");
            button.setAttribute("type", "radio");
            button.name = "choice" + mcCounter.toString();
            button.value = String(numCols - j - 1);
            cell.appendChild(button);
            cell.addEventListener("click", () => {
                button.checked = true;
            });
            cell.setAttribute("style", "text-align: center");
            row.appendChild(cell);
        }
        mcCounter++;
    }
    return mcCounter;
}

// Update a character-count display element with the remaining characters
function updateCharCountDisplay(messageElem: HTMLElement, charsLeft: number): void {
    messageElem.innerHTML = "Characters remaining: " + charsLeft.toString();
    messageElem.style.color = charsLeft >= 0 ? "black" : "red";
}

// ----------
// INITIALIZATION
// ----------

function parseRoles(rolesStr: string): string {
    if (rolesStr.includes("Instructor")) return "instructor";
    if (rolesStr.includes("Learner")) return "student";
    return "neither";
}

// Initialization code that should run immediately after the HTML has been loaded; sets up event handlers
function init(): void {
    // Set up all of the buttons' event handlers
    setUpButtons();
    setUpMonaco();

    const serverDataElem = document.getElementById("server-data")!;
    userId = serverDataElem.dataset.userId!;
    role = parseRoles(serverDataElem.dataset.roles ?? "");

    sendHeartbeat();
    makeGetRequest();
}

function handleWindowUnload(event: BeforeUnloadEvent): string {
    // Enable modal, passing event data
    event.preventDefault();
    event.returnValue = "continue";
    event.stopPropagation();
    return "continue";
}

function sendHeartbeat(): void {
    fetch(fetchEndpoint + "/users/heartbeat", {
        method: "GET",
        mode: "cors",
        headers: { "Content-Type": "text/plain" },
    })
        .then((response) => {
            if (!response.ok) {
                showConnectivityError(CONNECTIVITY_ERROR_MSG);
            } else {
                setTimeout(sendHeartbeat, 300000);
            }
        })
        .catch(() => {
            showConnectivityError(GENERIC_ERROR_MSG);
        });
}

function makeGetRequest(): void {
    // Request the next page
    const fetchValue = userId;
    fetch(fetchEndpoint + "/users/findByUserId/" + fetchValue + "?role=" + encodeURIComponent(role), {
        method: "GET",
        mode: "cors",
        headers: { "Content-Type": "text/plain" },
    })
        .then((response) => {
            if (!response.ok) {
                document.getElementById("connectivity")!.innerHTML = CONNECTIVITY_ERROR_MSG;
            }
            return response.json();
        })
        .then((data: any) => {
            processGetResponse(data);
        })
        .catch(() => {
            //throw error;
            showConnectivityError(GENERIC_ERROR_MSG);
        });
}

function makePostRequest(body: unknown, endpoint?: string): void {
    endpoint = endpoint ?? "saveScoreRecord";

    fetch(fetchEndpoint + "/users/" + endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        mode: "cors",
        headers: { "Content-Type": "application/json" },
    })
        .then((response) => {
            if (!response.ok) {
                document.getElementById("connectivity")!.innerHTML = CONNECTIVITY_ERROR_MSG;
            }
            return response.json();
        })
        .then((data: any) => {
            processGetResponse(data);
        })
        .catch(() => {
            //throw error;
            showConnectivityError(GENERIC_ERROR_MSG);
        });
}

function checkTrainingCorrectness(choices: string[], answers: number[]): void {
    // set correctness
    correctness = [];
    studentAnswers = [];
    for (let i = 0; i < choices.length; i++) {
        const choice = parseInt(choices[i]);
        const answer = answers[i];
        studentAnswers.push(choice);
        if (choice === answer) {
            correctness.push(0);
        } else if ((choice > 1 && answer > 1) || (choice <= 1 && answer <= 1)) {
            correctness.push(2);
        } else {
            correctness.push(1);
        }
    }
}

function displayFeedback(): void {
    document.getElementById("peerCriteria")!.hidden = true;
    // use correctness
    const correctnessColorMap: Record<number, string> = {
        0: "green",
        1: "red",
        2: "blue",
    };
    const correctnessTextMap: Record<number, string> = {
        0: "Correct!",
        1: "Incorrect!",
        2: "Close!",
    };
    const choiceMap: Record<number, string> = {
        3: "Implementation 1 is Much Better",
        2: "Implementation 1 is Slightly Better",
        // 3: "Implementations are about the same",
        1: "Implementation 2 is Slightly Better",
        0: "Implementation 2 is Much Better",
    };
    for (let i = 0; i < correctness.length; i++) {
        const text = "<b>" + correctnessTextMap[correctness[i]] + "</b>";
        const correctCell = document.getElementById("correctness" + i)!;
        correctCell.innerHTML = text;
        (correctCell as HTMLElement).style.color = correctnessColorMap[correctness[i]];
        const answerCell = document.getElementById("answer" + i)!;
        answerCell.innerHTML = choiceMap[studentAnswers[i]];
    }
    const feedbackDiv = document.getElementById("feedbackDiv")!;
    submitButton.innerHTML = "Continue";
    continueEnabled = false;
    setTimeout(enableContinue, trainingFeedbackWaitTime * 1000);
    feedbackDiv.hidden = false;
}

function enableContinue(): void {
    continueEnabled = true;
}

function makeGradingInfo(data: any): GoOrTsLanguageTerminology {
    // criteria is a flat array for peer/training, or { criteria_txt, rubric } for instructor
    const criteriaEntries: [string, ...unknown[]][] = Array.isArray(data.criteria)
        ? data.criteria
        : data.criteria.criteria_txt;
    const criteriaQuestions: Record<string, string> = {};
    const criteriaTitles: Record<string, string> = {};
    for (const [text] of criteriaEntries) {
        const { criteriaType, title, question } = detectCriteriaType(text as string);
        criteriaTitles[criteriaType] = title;
        if (question) criteriaQuestions[criteriaType] = question;
    }

    // peer/training use submission1; instructor(ta?) uses submission0
    const anyFiles: [string, string][] =
        data.submission1 ?? data.files?.submission1 ?? data.files?.submission0 ?? [];
    const isGo = anyFiles.find(([fileName]) => fileName.endsWith(".go"));
    return new GoOrTsLanguageTerminology(isGo ? "go" : "typescript", criteriaQuestions, criteriaTitles);
}

function displayData(data: any): void {
    theQuestions = data["criteria"];
    document.getElementById("error")!.hidden = true;
    document.getElementById("feedbackDiv")!.hidden = true;
    if (data["type"] === "self") {
        document.getElementById("normalRoot")!.style.display = "";
        type = "self";
        const isAfter = data["is_after"];

        // Hide alternate div
        document.getElementById("peerContent")!.hidden = true;
        document.getElementById("instructorContent")!.hidden = true;

        // Add questions to table and display self div
        addAllQuestions(theQuestions, type, isAfter);
        document.getElementById("selfContent")!.hidden = false;
    } else if (data["type"] === "peer") {
        type = "peer";

        // Hide alternate div
        document.getElementById("selfContent")!.hidden = true;
        document.getElementById("instructorContent")!.hidden = true;
        // Set up the code panes
        theFiles = data["files"];
        totalPeerEvals = data["total"];
        peerEvalIdx = data["index"];
        document.getElementById("peerInstructions")!.innerHTML =
            "Next, please complete <b>" +
            totalPeerEvals +
            "</b> pairwise peer evaluations. You are currently working on peer evaluation " +
            peerEvalIdx +
            "/" +
            totalPeerEvals +
            ".";

        const metricsEditorRoot = document.getElementById("metricsEditorRoot")!;
        metricsEditorRoot.style.display = "";
        document.getElementById("normalRoot")!.style.display = "none";
        let popupMessage =
            "Next, please complete <b>" +
            totalPeerEvals +
            "</b> pairwise peer evaluations." +
            "<br/><br/>For each pair of submissions, you must go through all of the evaluation criteria (Encapsulation, Modularity, Decoupling, Clarity, and Robustness) in order, identifying which implementation better meets each of the criteria. As you go, you will be asked to evaluate relevant software quality metrics on each implementation, which you should use to inform your choice of which implementation is better.<br/><br/>Some of these metrics will be immediately relevant to the current criterion; for example, in the process of evaluating Encapsulation you will be asked to identify whether each function has a single responsibility and whether public methods are used appropriately. In other cases, metrics that you computed earlier will be displayed as summary statistics to help you evaluate later criteria; for example, when you visit the functions within the Encapsulation step you will also be asked to assess the quality of each function's docmentation, but that information will not be used until you get to the Clarity step. This design is intended to decrease the number of passes that you need to make over the code." +
            "<br/><br/>Once you have evaluated all of the criteria, you will be asked to review your selections, comment on the implementations, and submit your evaluation." +
            "<br/><br/>You are currently working on peer evaluation <b>" +
            peerEvalIdx +
            "/" +
            totalPeerEvals +
            "</b>.";

        const peerCriteriaTypes = (data["criteria"] as [string, string, ...unknown[]][])
            .filter(([, isFR]) => isFR === "0")
            .map(([text]) => {
                const { criteriaType, title } = detectCriteriaType(text);
                return { criteriaType, title };
            });
        makePeerGradingPage({
            root: metricsEditorRoot,
            files1: theFiles.submission1,
            files2: theFiles.submission2,
            gradingInfo: makeGradingInfo(data),
            onSubmit: (grades, group1, group2) => {
                presetPeerResponses = [grades, group1, group2]
                checkAnswers()
            },
            showInstructions: () => showMessagePopup(popupMessage, false),
            extraQuestions: document.getElementById("peerFreeResponse"),
            criteriaTypes: peerCriteriaTypes,
        });
        showMessagePopup(popupMessage, false);

        // makePeerGradingPage(document.getElementById("metricsEditorRoot"))
        addAllFiles(theFiles, "peer");
        editorRefresh();

        // Add all questions to table and display peer div
        addAllQuestions(theQuestions, type, false);
        document.getElementById("peerContent")!.hidden = false;
    } else if (data["type"] === "instructor") {
        type = "instructor";

        // Hide alternate div
        document.getElementById("selfContent")!.hidden = true;
        document.getElementById("peerContent")!.hidden = true;

        // Set up code pane
        theFiles = data["files"];
        totalEvals = data["total"];
        instructorEvalIdx = data["index"];
        document.getElementById("instructorPageTracker")!.innerHTML =
            "In this " +
            (data["round"] === 0 ? "first" : "second") +
            " round of grading, you are responsible for grading <b>" +
            totalEvals +
            "</b> submissions. You are currently grading submission " +
            instructorEvalIdx +
            "/" +
            totalEvals +
            '. Please select all deductions that apply, and then click "Submit". Make sure to read and follow the rubric carefully, as some deductions may not be allowed to be combined with other deductions!' +
            "<br>";
        addAllFiles(theFiles, type);
        editorRefresh();

        // Set up the rubric tables

        // Add all questions to table and display instructor div
        addInstructorQuestions(data["criteria"]["criteria_txt"], data["criteria"]["rubric"]);
        document.getElementById("instructorContent")!.hidden = false;

        // Prepare the layout for the metrics editor
        const submissionColumn = document.querySelector("div:has(> #submission0)") as HTMLElement;
        submissionColumn.style.width = "65vw";
        submissionColumn.style.flex = "0 0 auto";
        (
            document.querySelector("#submission0>table>tbody>tr>td>.tabs") as HTMLElement
        ).style.margin = "0";
        const editorContainer = document.querySelector("#container0") as HTMLElement;
        editorContainer.hidden = false;
        editorContainer.classList.add("col");
        editorContainer.style.height = "80vh";

        // Create the editor/metrics interface
        try {
            taMetricGrades = makeTaInterface(
                editorContainer,
                data["criteria"]["criteria_txt"][0][0],
                theFiles.submission0,
                makeGradingInfo(data),
                (data: unknown, done: boolean) => {
                    (
                        document.querySelector("#instructorCompleteMetricsFirst") as HTMLElement
                    ).hidden = done;
                    (document.querySelector("#instructorCriteriaTable") as HTMLElement).hidden =
                        !done;
                    (document.querySelector("#submitButton") as HTMLElement).style.display = done
                        ? "block"
                        : "none";
                },
            );
        } catch (e) {
            console.error("Error building metrics editor:", e);
        }
        editorContainer.style.overflowY = "auto";
    } else if (data["type"] === "training") {
        type = "training";

        // hide alt. div
        document.getElementById("selfContent")!.hidden = true;
        document.getElementById("instructorContent")!.hidden = true;

        // set up code panes
        trainingIdx = data["idx"];
        totalEvals = data["total"];

        theFiles = {
            submission1: data["submission1"],
            submission2: data["submission2"],
        };

        const metricsEditorRoot = document.getElementById("metricsEditorRoot")!;
        metricsEditorRoot.style.display = "";
        document.getElementById("normalRoot")!.style.display = "none";

        let popupMessage =
            "Next, please complete <b>" +
            totalEvals +
            "</b> pairwise training evaluations." +
            "<br/><br/>These are designed to help to familiarize you with the evaluation criteria and workflow, and to give you feedback on the accuracy of your evaluations before you begin evaluating your peers." +
            "<br/><br/>For each pair of submissions, you must go through all of the evaluation criteria (Encapsulation, Modularity, Decoupling, Clarity, and Robustness) in order, identifying which implementation better meets each of the criteria. As you go, you will be asked to evaluate relevant software quality metrics on each implementation, which you should use to inform your choice of which implementation is better.<br/><br/>Some of these metrics will be immediately relevant to the current criterion; for example, in the process of evaluating Encapsulation you will be asked to identify whether each function has a single responsibility and whether public methods are used appropriately. In other cases, metrics that you computed earlier will be displayed as summary statistics to help you evaluate later criteria; for example, when you visit the functions within the Encapsulation step you will also be asked to assess the quality of each function's docmentation, but that information will not be used until you get to the Clarity step. This design is intended to decrease the number of passes that you need to make over the code." +
            "<br/><br/>Once you have evaluated all of the criteria, you will be asked to review your selections and submit your evaluation. You will then be provided with feedback on your evaluation." +
            "<br/><br/>You are currently working on training evaluation <b>" +
            (trainingIdx + 1) +
            "/" +
            totalEvals +
            "." +
            "</b><br>";

        const trainingCriteriaTypes = (data["criteria"] as [string, string, ...unknown[]][])
            .filter(([, isFR]) => isFR === "0")
            .map(([text]) => {
                const { criteriaType, title } = detectCriteriaType(text);
                return { criteriaType, title };
            });
        makePeerGradingPage({
            root: metricsEditorRoot,
            files1: theFiles.submission1,
            files2: theFiles.submission2,
            gradingInfo: makeGradingInfo(data),
            onSubmit: (grades: unknown, group1: unknown, group2: unknown) => {
                presetPeerResponses = [grades, group1, group2];
                checkAnswers();
            },
            showInstructions: () => showMessagePopup(popupMessage, false),
            extraQuestions: document.getElementById("peerFreeResponse")!,
            criteriaTypes: trainingCriteriaTypes,
        });
        showMessagePopup(popupMessage, false);

        const editorObj1 = createTabbedEditor(
            data["submission1"].filter(([name]: [string]) => name !== "metrics.json"),
        );
        const editorObj2 = createTabbedEditor(
            data["submission2"].filter(([name]: [string]) => name !== "metrics.json"),
        );
        editorObj1.element.style.height = "550px";
        editorObj2.element.style.height = "550px";
        document
            .querySelector("#submission1-editor-container")!
            .replaceChildren(editorObj1.element);
        document
            .querySelector("#submission2-editor-container")!
            .replaceChildren(editorObj2.element);

        addAllFeedback(data["feedback"], data["answers"], theQuestions);

        editorRefresh();

        // Add all questions to table and display training div
        addAllQuestions(theQuestions, type, false);
        document.getElementById("peerContent")!.hidden = false;
    }

    // Display submission button
    document.getElementById("submission")!.hidden = false;

    // Store uniqueID to use when responding
    uniqueID = data["unique_id"];
}

function processGetResponse(data: any): void {
    if (data.type == "instructor_dashboard") {
        document.getElementById("welcome")!.hidden = true;
        document.getElementById("connectivity")!.hidden = true;
        document.getElementById("error")!.hidden = true;
        (document.getElementsByClassName("footer")[0] as any).hidden = true;

        const dashboardElem = document.getElementById("instructorDashboard")!;
        dashboardElem.hidden = false;
        makeInstructorDashboard(dashboardElem, data, (a: unknown) => {
            makePostRequest(a, "createAssignment");
        }, fetchEndpoint);
        return;
    }

    if (prevData["type"] != "training") {
        clearTables("peer");
        clearTables("self");
        clearTables("instructor");
        displayData(data);
        window.scrollTo(0, 0);
    } else {
        displayFeedback();
    }
    prevData = data;

    if (data.hasOwnProperty("error") || data.hasOwnProperty("special_error")) {
        // Hide alternate divs
        document.getElementById("selfContent")!.hidden = true;
        document.getElementById("peerContent")!.hidden = true;
        document.getElementById("instructorContent")!.hidden = true;
        document.getElementById("submission")!.hidden = true;
        clearTables("self");
        clearTables("peer");
        clearTables("instructor");
        if (prevData["type"] === "training") {
            clearFeedbackTable();
        }

        // Display error message
        document.getElementById("errorMsg")!.classList.remove("has-text-success");
        if (data.hasOwnProperty("error")) {
            document.getElementById("errorMsg")!.innerHTML =
                data["error"] +
                ". Please refresh this page. If you continue to receive this error, please contact your instructor.";
        } else {
            document.getElementById("errorMsg")!.innerHTML = data["special_error"];
            if (data.tag === "success") {
                document.getElementById("errorMsg")!.classList.add("has-text-success");
            }
        }
        const existingNextBtn = document.getElementById("nextAssignmentBtn");
        if (existingNextBtn) existingNextBtn.remove();
        if (data["has_next_assignment"] === true) {
            const btn = document.createElement("button");
            btn.id = "nextAssignmentBtn";
            btn.className = "button is-primary mt-4 ml-4";
            btn.textContent = "Start next assignment";
            btn.onclick = () => window.location.reload();
            document.getElementById("error")!.appendChild(btn);
        }
        document.getElementById("error")!.hidden = false;
        return;
    }
}

// Set up the code editor
// value is the code that will first load onto the page
function setUpMonaco(): void {
    // set up instructor editor
    editor0 = createMonacoEditor("container0");
    // Set up left editor
    editor1 = createMonacoEditor("container1");
    // Set up right editor
    editor2 = createMonacoEditor("container2");
    // When the window resizes, resize both editors
    window.addEventListener("resize", editorRefresh);
}

function editorRefresh(): void {
    const parent0 = document.getElementById("container0")!.parentElement!;
    const parent1 = document.getElementById("container1")!.parentElement!;
    const parent2 = document.getElementById("container2")!.parentElement!;
    refreshEditor(editor0, parent0);
    refreshEditor(editor1, parent1);
    refreshEditor(editor2, parent2);
}

function setUpButtons(): void {
    // get "confirm submission" button and "submit" button from html
    const confirmButton = document.getElementById("confirmButton")!;
    const cancelButton = document.getElementById("cancelButton")!;
    submitButton = document.getElementById("submitButton")!;

    // assign "submit" button its function
    submitButton.addEventListener("click", submitContinueButtonPress);
    // assign "confirm submission" button its proper functions
    confirmButton.addEventListener("click", submitResponses);
    cancelButton.addEventListener("click", () => {
        document.getElementById("popUp")!.classList.remove("is-active");
    });

    // assign reflection submit button to corresponding function
    const refButton = document.getElementById("refButton")!;
    refButton.addEventListener("click", submitReflection);

    // Set up the ok button on the message modal
    document.getElementById("dismissMessageButton")!.addEventListener("click", () => {
        document.getElementById("messageModal")!.classList.remove("is-active");
    });
}

// ----------
// HELPER FUNCTIONS
// ----------

// code to clear out any additional empty spaces (from python)
function strip(string: string): string {
    return string.replace(/^\s+|\s+$/g, "");
}

// code to remove all child elements from parents
function removeAllChildElem(parent: HTMLElement): void {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

// get date and time right now
function getDateTime(): string {
    const today = new Date();
    const date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + " " + time;
}

// ----------
// ADDING ALL QUESTIONS
// ----------

// adds all questions to their corresponding table
function addAllQuestions(questions: string[][], type: string, isAfter: boolean): void {
    // to check question type
    const checkFreeResponse = (question: string[]) => question[1] === "1";
    const checkCriteria = (question: string[]) => question[1] === "0";

    // if at least one free response question exists, create heading for free response table
    if (type != "training" && questions.some(checkFreeResponse)) {
        // type = "self" or "peer" or "instructor"
        const freeResponseContent = document.getElementById(type + "FreeResponse")!;
        freeResponseContent.hidden = false;
    }

    if (type === "self" && isAfter) {
        // Must be the final reflection page -> update the instructions and also add an extra
        // table for the Likert scale questions
        document.getElementById("selfInstructions")!.innerHTML =
            "You've completed all of the peer evaluations! Last, please complete one final self evaluation, in which you will re-rate your own group&apos;s implementation on the following criteria. Once again, answers to this question will <b>not</b> affect your grade on the assignment, so please provide your honest self-assessment!";
    }

    // if at least one criteria question exists, create heading for criteria table
    const prefix = type === "training" ? "peer" : type;
    if (questions.some(checkCriteria)) {
        const multipleChoiceContent = document.getElementById(prefix + "Criteria")!;
        multipleChoiceContent.hidden = false;
    }

    let mcCounter = 0;
    let frCounter = 0;

    // iterating through questions to add to corresponding table
    for (let i = 0; i < questions.length; i++) {
        const row = document.createElement("tr");
        const text = document.createElement("td");
        const multipleChoiceTable = document.getElementById(prefix + "CriteriaTable")!;
        const freeResponseTable = document.getElementById(prefix + "FreeResponseTable")!;

        // for free response questions (true)
        if (questions[i][1] === "1") {
            if (type === "training") {
                continue;
            }
            // add text to free response column
            freeResponseTable.append(row);
            text.innerHTML = questions[i][0];
            row.appendChild(text);

            let numCols = 1;
            if (type === "peer") {
                numCols = 2;
            }

            const intToText: Record<number, string> = { 1: "One", 2: "Two" };
            for (let j = 0; j < numCols; j++) {
                // define cells to add
                const cellResponse1 = document.createElement("td");
                const charCounter1 = document.createElement("div");

                // create text input
                const inputText1 = document.createElement("textarea");
                inputText1.classList.add("textarea");
                inputText1.setAttribute("id", "sub" + intToText[j + 1] + frCounter.toString());
                inputText1.style.width = "100%";
                inputText1.style.resize = "vertical";

                // give character counters their individual id and innerHTML
                charCounter1.setAttribute("id", "char" + intToText[j + 1] + frCounter.toString());
                charCounter1.innerHTML = "Characters remaining: " + questions[i][2].toString();

                // add event listeners to text boxes
                inputText1.addEventListener("keyup", characterCount);

                // add text inputs to cells
                cellResponse1.appendChild(inputText1);
                cellResponse1.appendChild(charCounter1);

                // add cells to row
                row.appendChild(cellResponse1);
            }
            // keeps track of number of free response questions
            frCounter++;
        }

        // for criteria questions (false)
        else {
            text.innerHTML = questions[i][0];
            row.appendChild(text);
            multipleChoiceTable.appendChild(row);

            let numCols = 4;
            if (type === "self") {
                numCols = 5;
            }

            for (let j = 0; j < numCols; j++) {
                // define cells to add
                const cell = document.createElement("td");
                (cell as any).name = "choice" + mcCounter.toString() + "cell";
                const button = document.createElement("input");
                button.setAttribute("type", "radio");
                button.name = "choice" + mcCounter.toString();
                if (type === "peer") {
                    button.value = String(j);
                } else {
                    button.value = String(numCols - j - 1);
                }
                cell.appendChild(button);
                cell.addEventListener("click", () => {
                    button.checked = true;
                });

                cell.setAttribute("style", "text-align: center");
                row.appendChild(cell);
            }
            mcCounter++;
        }
    }
}

function addInstructorQuestions(question: string[][], rubric: any[]): void {
    const multipleChoiceContent = document.getElementById("instructorCriteria")!;
    multipleChoiceContent.hidden = false;

    let mcCounter = 0;
    const multipleChoiceTable = document.getElementById("instructorCriteriaTable")!;
    // filling in the Instructions
    const titleRow = document.createElement("tr");
    const title = document.createElement("td");
    title.innerHTML = question[0][0];
    multipleChoiceTable.appendChild(titleRow);
    titleRow.appendChild(title);

    radioButtons = [];
    for (let i = 0; i < rubric.length; i++) {
        const ptArray = JSON.parse(rubric[i][2]);
        const textArray = JSON.parse(rubric[i][1]);
        const mutuallyExclusive = JSON.parse(rubric[i][3]);

        const row = document.createElement("tr");
        const text = document.createElement("td");
        const multipleChoiceTable = document.getElementById("instructorCriteriaTable")!;
        text.innerHTML = rubric[i][0] + '<hr style="height: 15px; visibility:hidden"\>';
        multipleChoiceTable.appendChild(row);

        if (mutuallyExclusive) {
            radioButtons.push("choice" + i);
        }
        for (let j = 0; j < ptArray.length; j++) {
            // define cells to add
            const checkbox = document.createElement("input");
            if (mutuallyExclusive) {
                checkbox.setAttribute("type", "radio");
            } else {
                checkbox.setAttribute("type", "checkbox");
            }
            checkbox.setAttribute("id", "choice" + "-" + i + "-" + j);
            checkbox.name = "choice" + i;
            checkbox.setAttribute("data-point", ptArray[j]);
            const deduction = document.createElement("label");
            deduction.setAttribute("for", "choice" + "-" + i + "-" + j);
            deduction.setAttribute("style", "text-align: left; margin-left: 10px");
            deduction.innerHTML =
                textArray[j][0].trim() + '<hr style="height: 10px; visibility:hidden"\>';

            text.appendChild(checkbox);
            text.appendChild(deduction);

            mcCounter++;
        }
        (multipleChoiceTable as any).value = mcCounter;
        row.appendChild(text);
    }
}

function addAllFeedback(feedback: string[], answerKey: number[], questions: string[][]): void {
    const feedbackTable = document.getElementById("feedbackTable")!;
    let idx = 0;
    for (let questionIdx = 0; questionIdx < questions.length; questionIdx++) {
        if (questions[questionIdx][1] === "1") continue;

        const row = document.createElement("tr");
        const title = document.createElement("td");
        const answer = document.createElement("td");
        const correctnessElem = document.createElement("td");
        const text = document.createElement("td");

        correctnessElem.id = "correctness" + idx;
        row.id = "feedbackRow" + idx;
        row.setAttribute("data-point", String(answerKey[idx]));
        answer.id = "answer" + idx;

        title.innerHTML = questions[questionIdx][0];
        correctnessElem.innerHTML = "";
        text.innerHTML = feedback[idx];
        correctnessElem.style.textAlign = "center";
        answer.style.textAlign = "center";

        feedbackTable.appendChild(row);
        row.appendChild(title);
        row.appendChild(answer);
        row.appendChild(correctnessElem);
        row.appendChild(text);
        idx++;
    }
}

// ----------
// ADDING ALL FILES
// ----------

// adds all files to corresponding submission file
function addAllFiles(files: Record<string, [string, string][]>, type: string): void {
    let index: number;
    scrollMap0 = new Map();
    scrollMap1 = new Map();
    scrollMap2 = new Map();
    // assigning index based off of evaluation type.
    if (type === "instructor") {
        return;
    } else if (type === "peer" || type === "training") {
        // submission1
        setupSubmissionTabs(files["submission1"], editor1, scrollMap1, "panel1", 1);
        // submission2
        setupSubmissionTabs(files["submission2"], editor2, scrollMap2, "panel2", 2);
    }
}

// to open corresponding file contents
function openFile(event: Event): void {
    // access either tab1 or tab2
    let tab = event.target as HTMLElement;
    // from id, only get file name (slice it because id starts with 0/1 File/ tFile)
    const fileName = tab.id.slice(5);
    const fileIdx = tab.id.slice(0, 1);
    let fileContent: string = "";
    let editor: monaco.editor.IStandaloneCodeEditor;
    let scrollMap: Map<string, number>;

    if (fileIdx === "0") {
        editor = editor0;
        scrollMap = scrollMap0;
    } else if (fileIdx === "1") {
        editor = editor1;
        scrollMap = scrollMap1;
    } else {
        editor = editor2;
        scrollMap = scrollMap2;
    }

    if (fileName.includes(".css")) {
        monaco.editor.setModelLanguage(editor.getModel()!, "css");
    } else if (fileName.includes(".html")) {
        monaco.editor.setModelLanguage(editor.getModel()!, "html");
    } else {
        monaco.editor.setModelLanguage(editor.getModel()!, "typescript");
    }

    for (const file in theFiles["submission" + fileIdx]) {
        const fileInfo = theFiles["submission" + fileIdx][file];
        if (fileInfo[0] === fileName) {
            fileContent = fileInfo[1];

            tab = document.getElementById(fileIdx + "Tab" + fileInfo[0])!;
            if (!tab.classList.contains("is-active")) {
                editor.setScrollPosition({ scrollTop: scrollMap.get(fileName) ?? 0 });
                tab.classList.add("is-active");
            }
        } else {
            tab = document.getElementById(fileIdx + "Tab" + fileInfo[0])!;
            if (tab.classList.contains("is-active")) {
                scrollMap.set(fileInfo[0], editor.getScrollTop());
                tab.classList.remove("is-active");
            }
        }
    }

    editor.getModel()!.setValue(fileContent);
    editorRefresh();
}

// ----------
// LOGGING
// ----------

function showMessagePopup(message: string, error: boolean = true): void {
    const modalContent = document.getElementById("messageModalContent")!;
    if (error) {
        modalContent.classList.add("has-text-danger");
    } else {
        modalContent.classList.remove("has-text-danger");
    }
    modalContent.innerHTML = message;
    document.getElementById("messageModal")!.classList.add("is-active");
}
function hideMessagePopup(message: string): void {
    document.getElementById("messageModal")!.classList.remove("is-active");
}

let showMessage = showMessagePopup;
let hideMessage = hideMessagePopup;

// ----------
// BUTTONS
// ----------

// sends student responses to the backend
let presetPeerResponses: [unknown, unknown, unknown] | null = null;
function submitResponses(): void {
    const [passedCriteria, group1Grades, group2Grades] = presetPeerResponses ?? [null, null, null];
    presetPeerResponses = null;

    document.getElementById("popUp")!.classList.remove("is-active");
    document.getElementById("metricsEditorRoot")!.style.display = "none";
    if (type != "peer") {
        document.getElementById("normalRoot")!.style.display = "";
    }
    // Put it back
    document
        .getElementById("peerFreeResponseContainer")!
        .replaceChildren(document.getElementById("peerFreeResponse")!);

    const prefix = type === "training" ? "peer" : type;
    // radio buttons represented as 0, 1, 2, 3
    let criteria: string[] = [];
    // array of arrays [[<sub1Text>, <sub2Text>],...]
    let freeResponse: any[] = [];
    // current time
    const dateTime = getDateTime();

    const info: Record<string, any> = {};

    if (type === "instructor") {
        const multipleChoiceCriteriaTable = document.getElementById(prefix + "CriteriaTable")!;

        const deductions: string[] = [];
        const checkedList = document.querySelectorAll(
            "#instructorCriteria input[type='checkbox']:checked",
        );
        for (let i = 0; i < checkedList.length; i++) {
            criteria.push((checkedList[i] as HTMLInputElement).id);
            deductions.push((checkedList[i] as HTMLInputElement).getAttribute("data-point")!);
        }
        const checkedList2 = document.querySelectorAll(
            "#instructorCriteria input[type='radio']:checked",
        );
        for (let i = 0; i < checkedList2.length; i++) {
            criteria.push((checkedList2[i] as HTMLInputElement).id);
            deductions.push((checkedList2[i] as HTMLInputElement).getAttribute("data-point")!);
        }
        info["unique_id"] = uniqueID;
        info["choices"] = criteria;
        info["deductions"] = deductions;
        info["time_stamp"] = dateTime;
        info["free_responses"] = [JSON.stringify(taMetricGrades)];
        info["type"] = type;
    } else {
        // how many criteria questions are there?
        const multipleChoiceCriteriaTable = document.getElementById(prefix + "CriteriaTable")!;
        const mcQuestions = multipleChoiceCriteriaTable.childElementCount;

        // how many free response questions are there?
        const freeResponseTable = document.getElementById(prefix + "FreeResponseTable")!;
        const frQuestions = freeResponseTable.childElementCount;

        // loop through criteria questions to see which answer out of 4 is selected (0, 1, 2, 3)
        if (passedCriteria) {
            criteria = [...(passedCriteria as string[])];
        } else {
            let i: number;
            for (i = 0; i < mcQuestions; i++) {
                const selectedAnswer = (
                    document.querySelector(
                        "input[name=choice" + i.toString() + "]:checked",
                    ) as HTMLInputElement
                ).value;
                criteria.push(selectedAnswer);
            }
        }

        // loop through free response questions to access user input
        for (let i = 0; i < frQuestions; i++) {
            const response: string[] = [];
            let sub1Text = (document.getElementById("subOne" + i.toString()) as HTMLInputElement)
                .value;
            sub1Text = sub1Text.replace(/'/g, "\\'");

            if (type === "peer") {
                response.push(sub1Text);
                let sub2Text = (
                    document.getElementById("subTwo" + i.toString()) as HTMLInputElement
                ).value;
                sub2Text = sub2Text.replace(/'/g, "\\'");
                response.push(sub2Text);
                freeResponse.push(response);
            } else {
                freeResponse.push(sub1Text);
            }
        }

        if (group1Grades) {
            freeResponse.push([group1Grades, group2Grades]);
        }

        info["unique_id"] = uniqueID;
        info["choices"] = criteria;
        info["free_responses"] = freeResponse;
        info["time_stamp"] = dateTime;
        info["type"] = type;
    }
    if (type === "training") {
        checkTrainingCorrectness(info["choices"], (prevData as any).answers);
    }

    makePostRequest(info);
}

function clearFeedbackTable(): void {
    // remove all element where id starts with feedbackRow
    if (studentAnswers != undefined) {
        for (let i = 0; i < studentAnswers.length; i++) {
            const row = document.getElementById("feedbackRow" + i)!;
            row.parentNode!.removeChild(row);
        }
    }
}
// to determine what happens after submitting current page (reloads or takes to reflection page?)
function clearTables(type: string): void {
    try {
        // remove criteria table content, and hide table
        const multipleChoiceCriteria = document.getElementById(type + "Criteria")!;
        const multipleChoiceCriteriaTable = document.getElementById(type + "CriteriaTable")!;
        if (!(multipleChoiceCriteriaTable.childElementCount === 0)) {
            removeAllChildElem(multipleChoiceCriteriaTable);
        }
        multipleChoiceCriteria.hidden = true;

        // remove free response content, and hide table
        if (type === "peer" || type === "self") {
            const freeResponse = document.getElementById(type + "FreeResponse")!;
            const freeResponseTable = document.getElementById(type + "FreeResponseTable")!;
            removeAllChildElem(freeResponseTable);
            freeResponse.hidden = true;
        }

        // remove files
        if (type === "peer") {
            const panel1 = document.getElementById("panel1")!;
            const panel2 = document.getElementById("panel2")!;
            removeAllChildElem(panel1);
            removeAllChildElem(panel2);
        }
        if (type === "instructor") {
            removeAllChildElem(document.getElementById("panel0")!);
        }

        // hide modal
        const modal = document.getElementById("popUp")!;
        modal.classList.remove("is-active");
    } catch (_) {}
}

function submitContinueButtonPress(): void {
    if (submitButton.innerHTML === "Continue") {
        const message = document.getElementById("hiddenMessage")!;
        if (continueEnabled) {
            submitButton.innerHTML = "Submit";
            clearFeedbackTable();
            clearTables("peer");
            //console.log("about to display next training");
            displayData(prevData);
            window.scrollTo(0, 0);
            message.hidden = true;
            // makeGetRequest();
        } else {
            showMessage(
                "Please take a minute to carefully read the feedback before you proceed to the next evaluation!",
            );
            // message.hidden = false;
        }
    } else {
        checkAnswers();
    }
}

// to make sure that all questions are answered before submitting
function checkAnswers(): void {
    const submitButton = document.getElementById("submitButton")!;
    // are all questions answered?
    const prefix = type === "training" ? "peer" : type;
    let allAnswered = true;
    // are all free response questions within character count?
    let withinCharCount = true;

    let questionsExist = false;

    // get number of each type of question
    const multipleChoiceTable = document.getElementById(prefix + "CriteriaTable")!;

    if (type !== "instructor") {
        const mcQuestions = multipleChoiceTable.childElementCount;
        const freeResponseTable = document.getElementById(prefix + "FreeResponseTable")!;
        const frQuestions = freeResponseTable.childElementCount;
        questionsExist = mcQuestions > 0;
        if (type === "peer") {
            questionsExist = questionsExist && frQuestions > 0;
        }

        // loop through criteria questions to make sure all are answered
        if (presetPeerResponses) {
            for (const criteria of presetPeerResponses[0] as string[]) {
                if (!["0", "1", "2", "3"].includes(criteria)) {
                    allAnswered = false;
                    break;
                }
            }
        } else {
            let i: number;
            for (i = 0; i < mcQuestions; i++) {
                if (
                    document.querySelector("input[name=choice" + i.toString() + "]:checked") ===
                    null
                ) {
                    allAnswered = false;
                    break;
                }
            }
        }

        // loop through free response questions to make sure all are answered
        for (let i = 0; i < frQuestions; i++) {
            const sub1Text = strip(
                (document.getElementById("subOne" + i.toString()) as HTMLInputElement).value,
            );
            if (sub1Text === "") {
                allAnswered = false;
                break;
            }

            if (type === "peer") {
                const sub2Text = strip(
                    (document.getElementById("subTwo" + i.toString()) as HTMLInputElement).value,
                );
                if (sub2Text === "") {
                    allAnswered = false;
                    break;
                }
            }
        }

        // get max character count from questions
        for (let i = 0; i < theQuestions.length; i++) {
            // if question is free response, get max character count
            if (theQuestions[i][1] === "1") {
                const maxChar = Number(theQuestions[i][2]);
                for (let i = 0; i < frQuestions; i++) {
                    // check if texts go over max character count
                    const sub1Text = strip(
                        (document.getElementById("subOne" + i.toString()) as HTMLInputElement)
                            .value,
                    );
                    if (sub1Text.length > maxChar) {
                        withinCharCount = false;
                        break;
                    }

                    if (type === "peer") {
                        const sub2Text = strip(
                            (document.getElementById("subTwo" + i.toString()) as HTMLInputElement)
                                .value,
                        );
                        if (sub2Text.length > maxChar) {
                            withinCharCount = false;
                        }
                    }
                }
            }
        }

        if (allAnswered === false && withinCharCount === false) {
            showMessage(
                "Make sure to answer all questions before submitting and check that your answers are within the maximum character count!",
            );
        } else if (allAnswered === false && withinCharCount === true) {
            showMessage("Make sure to answer all questions before submitting!");
        } else if (allAnswered === true && withinCharCount === false) {
            showMessage(
                "Make sure to check that your answers are within the maximum character count!",
            );
        } else if (false && !questionsExist) {
            showMessage("Error loading questions; please refresh the page!");
        } else {
            // hide message
            hideMessage("");
            // make sure modal pops up on submit button
            const modal = document.getElementById("popUp")!;
            modal.classList.toggle("is-active");
        }
    } else {
        const checkedList = document.querySelectorAll(
            "#instructorCriteria input[type='radio']:checked",
        );
        if (checkedList.length != radioButtons.length) {
            showMessage(
                "Make sure to select one item from each of the sections with (round) radio buttons. For the sections with (square) checkboxes, it's fine to select none if none are applicable.",
            );
        } else {
            // hide message
            hideMessage("");
            // make sure modal pops up on submit button
            const modal = document.getElementById("popUp")!;
            modal.classList.toggle("is-active");
        }
    }
}

// ----------
// REFLECTION PAGE
// ----------

// will submit reflection and send to backend
function submitReflection(): [string, string] | void {
    const reflection = strip((document.getElementById("refText") as HTMLInputElement).value);
    const message = document.getElementById("refMessage")!;
    // if reflection is empty, make message pop up that they haven't written anything
    if (reflection === "") {
        message.hidden = false;
    }

    // if reflection is written, return reflection and time submitted
    else {
        const refPage = document.getElementById("reflectionPage")!;
        refPage.hidden = true;
        const finalPage = document.getElementById("finalPage")!;
        finalPage.hidden = false;

        // get time that student submitted
        const dateTime = getDateTime();

        return [reflection, dateTime];
    }
}

// ----------
// CHARACTER COUNTER
// ----------

function characterCount(event: Event): void {
    const text = event.target as HTMLInputElement;
    let message: HTMLElement;

    // get array of only free response questions
    const frQuestions: string[][] = [];
    for (let i = 0; i < theQuestions.length; i++) {
        if (theQuestions[i][1] === "1") {
            frQuestions.push(theQuestions[i]);
        }
    }

    // get max character of text from corresponding free response question
    let maxChar: number = 0;
    const index = Number(text.id.slice(6));
    for (let i = 0; i < frQuestions.length; i++) {
        if (i === index) {
            maxChar = Number(frQuestions[i][2]);
            // get html element where message will show up
            if (text.id.slice(0, 6) === "subOne") {
                message = document.getElementById("charOne" + i.toString())!;
            } else {
                message = document.getElementById("charTwo" + i.toString())!;
            }
            break;
        }
    }

    // updating UI
    const length = text.value.length;
    const charLeft = maxChar - length;
    updateCharCountDisplay(message!, charLeft);
}

// character counter for reflection page
function refCharacterCount(): void {
    // get text, its length, message, and characters left
    const text = document.getElementById("refText") as HTMLInputElement;
    const length = text.value.length;
    const message = document.getElementById("refCharCounter")!;
    const charLeft = 1000 - length;

    // update UI
    updateCharCountDisplay(message, charLeft);
}

const refText = document.getElementById("refText")!;
refText.addEventListener("keyup", refCharacterCount);
