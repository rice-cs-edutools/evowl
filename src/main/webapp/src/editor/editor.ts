/*
 * This file defines a wrapper around monaco editor that provides tabs
 * and an API for switching between them.
 */

import "../styles/accordion.css";
import "../styles/editor.css";
import "../styles/menu.css";
import "../styles/metricSidebar.css";
import "../styles/rubric.css";
import "../styles/util.css";
import "../styles/codicon.css";

import * as monaco from "monaco-editor";
import { div, el, span } from "../utils/elements";

export type MonacoEditor = monaco.editor.IStandaloneCodeEditor;

// [Filename, Content]
export type FileInfo = [string, string];

/*
 * A type holding information about the tabbed editor returned by
 * createTabbedEditor.
 */
export type TabbedEditor = {
  // The HTML element holding the tabbed editor
  element: HTMLElement;
  // The monaco instance at the core of the editor
  monaco: MonacoEditor;
  // Files being viewed
  files: FileInfo[];
  // The current tab index
  currentTab: number;
  // The list of tabs
  tabs: TabbedEditorTab[];
  // Current module label
  setCurrentModuleLabel: (mod: string) => void;
  // A callback to be called after switching tabs
  onSwitchTab?: (e: TabbedEditor) => void;
  // Determines which tabs to show
  tabGroup: string | undefined;
};

type TabbedEditorTab = {
  filename: string;
  group: string | undefined;
  mod: string | undefined;
  content: string;
  element: HTMLElement;
};

/*
 * A function to be used in .sort() to sort module names
 */
export function compareModules(mod1: string, mod2: string): number {
  if (mod1 === "main") return -1;
  if (mod2 === "main") return 1;
  return mod2 < mod1 ? 1 : -1;
}

/*
 * Create a wrapper around the monaco editor providing a tab list at
 * the top of the editor for switching between files.
 */
export function createTabbedEditor(
  files: FileInfo[],
  groups?: Map<string, string>,
  groupLabel?: string,
): TabbedEditor {
  // Create a div to represent the tab panel, and a ul inside of the
  // div to hold the actual tabs
  const tabsListElem = el("ul", "editor-tabs-scroll");
  const dropdownContainerElem = div();
  const tabsContainerElem = div("row justify-start", [
    dropdownContainerElem,
    div("tabs is-outlined", tabsListElem),
  ]);
  const editorElem = div("monaco-container flex-1");

  const language = "go";
  monaco.languages.registerHoverProvider(language, {
    provideHover: () => null,
  });
  const info: TabbedEditor = {
    element: div("editor col flex-1", [div("", tabsContainerElem), editorElem]),
    monaco: monaco.editor.create(editorElem, {
      value: files[0][1],
      language: language,
      theme: "vs-light",
      automaticLayout: true,
      minimap: { enabled: false },
      renderLineHighlight: "none",
      showDeprecated: false,
      readOnly: true,
      folding: false,
      rulers: [],
      scrollBeyondLastLine: false,
      scrollbar: { vertical: "hidden", horizontal: "hidden" },
    }),
    files: files,
    currentTab: 0,
    tabs: [],
    setCurrentModuleLabel: () => {},
    tabGroup: `${Math.random()}`,
  };

  // Create a tab for each file
  for (let [filename, content] of files) {
    if (groups && !groups.has(filename)) continue;
    if (filename.endsWith("go.mod")) continue;

    const index = info.tabs.length;
    const tabElem = el("li", "", [el("a", "", fileNameBase(filename))]);
    // When clicking on tab, it opens corresponding file contents
    tabElem.addEventListener("click", () => selectTab(info, index));

    tabsListElem.appendChild(tabElem);

    info.tabs.push({
      filename: filename,
      group: groups?.get(filename),
      mod: undefined,
      content: content,
      element: tabElem,
    });
  }

  if (groups) {
    // Create a dropdown for the different modules
    const setCurrentModuleLabel = makeBulmaDropdown(
      dropdownContainerElem,
      "main",
      Array.from(new Set(info.tabs.map((tab) => tab.group))).sort(
        compareModules,
      ),
      (mod) => {
        const newIndex = info.tabs.findIndex((tab) => tab.group === mod);
        if (newIndex !== -1) {
          selectTab(info, newIndex);
        }
      },
      groupLabel,
    );
    info.setCurrentModuleLabel = setCurrentModuleLabel;
    selectTabGroup(info, info.tabs[0].group);
  }
  selectTab(info, 0);

  return info;
}

/*
 * Create a bulma dropdown in the specified element.
 * This will return a function that can be used to set the current element.
 */
export function makeBulmaDropdown(
  where: HTMLElement,
  active: string,
  items: string[],
  onSelect?: (item: string) => void,
  label: string = "",
): (l: string) => void {
  const labelSpan = span("", label + active);

  const dropdown = div("dropdown", [
    // Trigger
    div("dropdown-trigger", [
      el(
        "button",
        "button",
        [
          labelSpan,
          el("span", "icon is-small", [
            el("i", "fas fa-angle-down", undefined, {
              ["aria-hidden" as any]: "true",
            }),
          ]),
        ],
        {
          ["aria-haspopup" as any]: "true",
          ["aria-controls" as any]: "dropdown-menu",
        },
      ),
    ]),

    // Menu
    div("dropdown-menu", [
      div(
        "dropdown-content",
        items.map((item) =>
          el("a", "dropdown-item", item, {
            onclick: () => {
              if (onSelect) onSelect(item);
              labelSpan.innerText = label + item;
              dropdown.classList.remove("is-active");
            },
          }),
        ),
      ),
    ]),
  ]);

  // Toggle dropdown on button click
  const triggerBtn = dropdown.querySelector("button");
  triggerBtn?.addEventListener("click", () => {
    dropdown.classList.toggle("is-active");
  });

  where.replaceChildren(dropdown);
  return (value) => (labelSpan.innerText = label + value);
}

/*
 * Determine the base name for a particular file
 */
export function fileNameBase(filename: string): string {
  const lastSlash = filename.lastIndexOf("/");
  return lastSlash === -1 ? filename : filename.substring(lastSlash + 1);
}

/*
 * Show tabs for a particular module
 */
export function selectTabGroup(info: TabbedEditor, mod: string) {
  // Set elements to hidden or not
  for (const tab of info.tabs) {
    tab.element.style.display = tab.group === mod ? "block" : "none";
  }
  info.setCurrentModuleLabel(mod);
}

/*
 * Display a different tab in the tabbed editor
 */
export function selectTab(info: TabbedEditor, index: number) {
  if (info.tabs[index].group !== info.tabs[info.currentTab].group) {
    selectTabGroup(info, info.tabs[index].group);
  }

  info.tabs[info.currentTab].element.classList.remove("is-active");
  info.currentTab = index;
  info.tabs[index].element.classList.add("is-active");
  info.monaco.setValue(info.tabs[index].content);
  // Scroll to the top
  info.monaco.revealLine(1);

  info.onSwitchTab?.call(info);
}
