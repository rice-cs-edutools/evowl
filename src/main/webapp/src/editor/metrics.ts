/*
 * This file defines types for the metrics output by the go analyzer,
 * and also implements an additional wrapper around the tabbed editor
 * implemented in editor.ts. This wrapper adds the metric sidebar
 * implemented in metricsUi.ts, and also implements highlighting and
 * browsing metrics.
 */

import * as monaco from "monaco-editor";
import {
  createTabbedEditor,
  FileInfo,
  selectTab,
  TabbedEditor,
} from "./editor";
import { div } from "../utils/elements";
import z from "zod";

const SHOW_METRIC_HIGHLIGHTS = false;

/*
 * Types for imported metrics
 */

export const CodeLocationSchema = z.object({
  File: z.string(),
  Offset: z.number(),
  StartLine: z.number(),
  StartCol: z.number(),
  EndLine: z.number(),
  EndCol: z.number(),
});
export const NamedCodeLocationSchema = z.intersection(
  CodeLocationSchema,
  z.object({ Name: z.string() }),
);

const ModuleExportStatsSchema = z.object({
  Files: z.array(z.string()),

  // Modularity & Cohesion
  FileCount: z.number(),
  LineCount: z.number(),

  // Interfaces and encapsulation
  PublicFuncs: z.array(NamedCodeLocationSchema),
  PublicStructs: z.array(NamedCodeLocationSchema),
  PublicStructFields: z.array(NamedCodeLocationSchema),
  PrivateStructFields: z.array(NamedCodeLocationSchema),

  // Error checks (flattened)
  ErrorChecks: z.array(CodeLocationSchema),
  MisnamedErrorChecks: z.array(CodeLocationSchema),
  MissingErrorChecks: z.array(CodeLocationSchema),

  // Documentation
  DocFuncs: z.array(NamedCodeLocationSchema),
  DocStructs: z.array(NamedCodeLocationSchema),
  NodocFuncs: z.array(NamedCodeLocationSchema),
  NodocStructs: z.array(NamedCodeLocationSchema),

  // Imported packages
  ExternalImportUses: z.array(NamedCodeLocationSchema),
  ModuleImportUses: z.array(NamedCodeLocationSchema),
});

const ProjectMetricsSchema = z.record(z.string(), ModuleExportStatsSchema);

export type CodeSegment = z.infer<typeof CodeLocationSchema>;
export type NamedCodeSegment = z.infer<typeof NamedCodeLocationSchema>;
export type ModuleMetrics = z.infer<typeof ModuleExportStatsSchema>;
export type ProjectMetrics = z.infer<typeof ProjectMetricsSchema>;

export function verifyProjectMetrics(obj: any): ProjectMetrics {
  const metrics = ProjectMetricsSchema.parse(obj);
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key.replace(/^go-compile\/coverage-after/, "go-compile"),
      value,
    ]),
  );
}

/*
 * An object describing a particular instance of a monaco editor with
 * the metrics sidebar
 */
export type EditorWithMetrics = {
  // The root element containing the metrics editor
  element: HTMLElement;
  // Information for the monaco editor itself and the current tab
  tabbedEditor: TabbedEditor;
  // Metrics for the project
  metrics: ProjectMetrics;
  // A mapping of file names to which tab group to store them in
  fileGroups: Map<string, string>;
  // Group method
  groupMethod: "metrics" | "directory";
  // A cached mapping of file names to metric highlights in the filename
  highlights: Map<
    string,
    { metric: LocationMetric; location: NamedCodeSegment }[]
  >;
  // A set of enabled metrics
  selected: Set<LocationMetric>;
  // The current search result
  // If non-null, the result of the last metric search
  searchResult?: {
    location: CodeSegment;
    decorationId: string;
  };
  // Element that shows the current search
  searchPopupElem: HTMLElement;
};

type KeysWithType<O, V> = {
  [K in keyof O]: O[K] extends V ? K : never;
}[keyof O];
// A type containing all metrics whose type is a CodeSegment[]
export type LocationMetric = KeysWithType<ModuleMetrics, CodeSegment[]>;
export type NamedLocationMetric = KeysWithType<
  ModuleMetrics,
  NamedCodeSegment[]
>;

/*
 * A type for providing more details on a particular metric
 */
export type LocationMetricInfo = {
  title: string;
  type: "normal" | "warning" | "error";
  description?: string;
};

/*
 * A collection of locational metrics, and more information about each of them
 */
export const locationMetricInfo: Record<LocationMetric, LocationMetricInfo> = {
  ErrorChecks: { type: "normal", title: "Present Error Check" },
  MisnamedErrorChecks: { type: "warning", title: "Misnamed Error Variable" },
  MissingErrorChecks: { type: "error", title: "Missing Error Check" },

  DocFuncs: { type: "normal", title: "Documented Function" },
  NodocFuncs: { type: "error", title: "Undocumented Function" },
  DocStructs: { type: "normal", title: "Documented Struct" },
  NodocStructs: { type: "error", title: "Undocumented Struct" },

  PublicFuncs: { type: "normal", title: "Public Function" },
  PublicStructs: { type: "normal", title: "Public Struct" },
  PublicStructFields: { type: "normal", title: "Public Struct Field" },
  PrivateStructFields: { type: "normal", title: "Private Struct Field" },

  ExternalImportUses: { type: "error", title: "External Import" },
  ModuleImportUses: { type: "error", title: "Package Import" },
};
export const locationMetrics = Object.keys(
  locationMetricInfo,
) as LocationMetric[];

// const coveragePrefix = "coverage-after/";
const coveragePrefix = "";
const metricsFileName = "metrics.json"; // Location inside the coverage directory

/*
 * Create a wrapper around a tabbed editor which also shows the module
 * metrics.
 */
export function makeMetricsEditor<T = void>(
  root: HTMLElement,
  files: [string, string][],
  groupMethod: "metrics" | "directory",
  makeSidebar: (root: HTMLElement, info: EditorWithMetrics) => T,
): T {
  // Parse the metrics file
  const metricsFilePair = files.find(
    ([name, _]) => name == coveragePrefix + metricsFileName,
  );
  if (!metricsFilePair) {
    root.replaceChildren(div("has-text-error", "Metrics not found"));
    console.error("Metrics not found", files);
    return undefined;
  }
  const [_, metricsContent] = metricsFilePair;
  const metrics = Object.fromEntries(
    Object.entries(verifyProjectMetrics(JSON.parse(metricsContent))).map(
      ([pkg, pkgMetrics]) => [packageAbbreviation(pkg), pkgMetrics],
    ),
  );

  // Collect the code files
  const codeFiles = files.flatMap(([name, content]) => {
    if (!name.startsWith(coveragePrefix) || name.endsWith("go.mod")) return [];
    const newName = name.substring(coveragePrefix.length);
    return newName == metricsFileName ? [] : [<FileInfo>[newName, content]];
  });

  // Generate a mapping from file names to package names
  const fileGroups = new Map<string, string>();
  if (groupMethod === "metrics") {
    for (const pkg in metrics) {
      for (const file of metrics[pkg].Files) {
        fileGroups.set(file, pkg);
      }
    }
  } else if (groupMethod === "directory") {
    for (const [fileName] of codeFiles) {
      const split = fileName.split("/");
      const dir = split.slice(0, split.length - 1).join("/") || "/";
      fileGroups.set(fileName, dir);
    }
  }

  // The popup element in the corner that shows the current search
  const searchPopupElem = div(
    "metric-search-popup row",
    [],
    {},
    { display: "none" },
  );
  // The underlying code editor
  const tabbedEditorInfo = createTabbedEditor(
    codeFiles,
    fileGroups,
    groupMethod === "metrics" ? "Select Package: " : "Select Directory: ",
  );
  // Set the module of the tabs
  for (const tab of tabbedEditorInfo.tabs) {
    tab.mod = groupMethod === "metrics" ? tab.group : tab.filename;
  }

  // A container holding both of them
  const editorElem = div("pos-rel col flex-1", [
    tabbedEditorInfo.element,
    searchPopupElem,
  ]);

  // The parent element to hold the sidebar
  const sidebarElem = div(
    "metrics overflow-auto no-scrollbar border-bottom col gap-1",
  );
  // Allow the padding to be overridden by the children
  sidebarElem.style.padding = "0 12px";

  // Create the object holding all info related to the metrics editor
  const info: EditorWithMetrics = {
    element: div("row flex-1", [sidebarElem, editorElem]),
    tabbedEditor: tabbedEditorInfo,
    metrics: metrics,
    fileGroups: fileGroups,
    groupMethod: groupMethod,
    selected: new Set(locationMetrics),
    highlights: calculateMetricHighlights(metrics),
    searchPopupElem: searchPopupElem,
  };

  displayMetricHighlights(info);
  tabbedEditorInfo.onSwitchTab = () => displayMetricHighlights(info);

  root.replaceChildren(info.element);

  try {
    return makeSidebar(sidebarElem, info);
  } catch (e) {
    console.error("Error creating sidebar", e);
    sidebarElem.replaceChildren(
      div("has-text-danger", [`Error showing metrics: ${e}`]),
    );
  }
}

/*
 * Return a list of code locations for `metric'. The metric might be
 * global, or per module. If it is per module, concatenate the code
 * locations for each module.
 */
export function getMetricLocations(
  metrics: ProjectMetrics,
  metric: LocationMetric,
): NamedCodeSegment[] {
  return Object.values(metrics).flatMap(
    (m) => (m as any)[metric] as NamedCodeSegment[],
  );
}

/*
 * The EditorWithMetrics object contains a mapping from file names to
 * the list of highlights that occur in that file, so that when you
 * switch between files, the ui can efficiently know which code
 * regions to highlight. This function constructs that map.
 */
export function calculateMetricHighlights(
  metrics: ProjectMetrics,
): EditorWithMetrics["highlights"] {
  const highlights: EditorWithMetrics["highlights"] = new Map();
  for (const metric of locationMetrics) {
    // Put each location into its respective file
    for (const location of getMetricLocations(metrics, metric)) {
      const hl = { metric: metric as LocationMetric, location: location };
      if (highlights.has(location.File)) {
        highlights.get(location.File).push(hl);
      } else {
        highlights.set(location.File, [hl]);
      }
    }
  }
  return highlights;
}

/*
 * Return a negative number if a is before b, 0 if a and b are the
 * same, and a positive number if a is after b. File names are
 * compared using the standard javascript string comparison.
 */
export function compareCodeLocations(a: CodeSegment, b: CodeSegment): number {
  if (a.File != b.File) {
    return b.File < a.File ? 1 : -1;
  }
  return (
    a.StartLine - b.StartLine ||
    a.StartCol - b.StartCol ||
    a.EndLine - b.EndLine ||
    a.EndCol - b.EndCol
  );
}

/*
 * Return an abbreviated name for a package
 */
export function packageAbbreviation(pkgPath: string): string {
  const rootPkg = "go-compile";
  if (pkgPath === rootPkg) {
    return "main";
  } else if (pkgPath.startsWith(rootPkg + "/")) {
    return pkgPath.substring(rootPkg.length + 1);
  } else {
    return pkgPath;
  }
}

/*
 * When searching for the next instance of a metric, show a popup
 * indicating which metric is being searched for, how many instances
 * there are, and what the current index is.
 */
function showMetricPopup(
  elem: HTMLElement,
  title: string,
  index: number,
  length: number,
) {
  elem.style.display = "block";
  elem.replaceChildren(
    div("mr-5", [title]),
    div("has-text-grey-light", [`${index}/${length}`]),
  );
}

/*
 * The previously searched for metric is stored in the `searchResult'
 * field of the `EditorWithMetrics' object. Find the next instance of
 * any of the metrics in `metrics', store it in the `searchResult'
 * field, and then navigate to it in the editor.
 */
export function metricSearchForward(
  info: EditorWithMetrics,
  locations: CodeSegment[],
  title: string,
  metricType: "normal" | "error" | "warning" = "normal",
  backward: boolean = false,
) {
  // Delete the old highlight
  const editor = info.tabbedEditor.monaco;
  if (info.searchResult) {
    editor.deltaDecorations([info.searchResult.decorationId], []);
  }

  // Sort the metric locations
  // const locations = metrics.flatMap((metric) => getMetricLocations(info.metrics, metric));
  locations.sort(compareCodeLocations);
  if (locations.length == 0) {
    showMetricPopup(info.searchPopupElem, title, 0, 0);
    info.searchResult = undefined;
    return;
  }

  // Find the next instance

  const seg = backward
    ? (info.searchResult &&
        [...locations]
          .reverse()
          .find(
            (loc) => compareCodeLocations(loc, info.searchResult.location) < 0,
          )) ||
      locations[locations.length - 1]
    : (info.searchResult &&
        locations.find(
          (loc) => compareCodeLocations(loc, info.searchResult.location) > 0,
        )) ||
      locations[0];

  showCodeSegment(info, seg, metricType);

  const segIdx = locations.findIndex((obj) => obj == seg);
  showMetricPopup(info.searchPopupElem, title, segIdx + 1, locations.length);
  //console.log("after", info.searchResult);
}

/*
 * Jump to a code segment, and highlight it with a certain color
 */
export function showCodeSegment(
  info: EditorWithMetrics,
  seg: CodeSegment,
  metricType: "normal" | "warning" | "error",
) {
  const editor = info.tabbedEditor.monaco;
  editor.deltaDecorations(
    editor
      .getModel()
      ?.getAllDecorations()
      .filter((d) => d.options?.className === "metric-search-result")
      .map((d) => d.id) || [],
    [],
  );

  // Switch to the correct tab
  const newTab = info.tabbedEditor.tabs.findIndex(
    (tab) => tab.filename == seg.File,
  );
  if (newTab == -1) throw new Error(`File ${seg.File} does not exist`);
  if (newTab != info.tabbedEditor.currentTab) {
    selectTab(info.tabbedEditor, newTab);
  }

  // Scroll to the segment
  info.tabbedEditor.monaco.revealLineInCenter(
    seg.StartLine,
    monaco.editor.ScrollType.Smooth,
  );
  // Highlight the segment
  const [newId] = info.tabbedEditor.monaco.deltaDecorations(
    [],
    [
      {
        range: new monaco.Range(
          seg.StartLine,
          seg.StartCol,
          seg.EndLine,
          seg.EndCol,
        ),
        options: {
          zIndex: 10, // Show above the normal highlight
          isWholeLine: false,
          className: `metric-search-result`,
        },
      },
    ],
  );
  // Save the location and decoration id for the next search
  info.searchResult = {
    location: seg,
    decorationId: newId,
  };
}

/*
 * Using the mapping created by `calculateMetricHighlights', display
 * the highlights for the currently open file.
 */
export function displayMetricHighlights(info: EditorWithMetrics) {
  if (!SHOW_METRIC_HIGHLIGHTS) return;

  const currentFile =
    info.tabbedEditor.tabs[info.tabbedEditor.currentTab].filename;
  const highlights = info.highlights.get(currentFile) ?? [];
  const editor = info.tabbedEditor.monaco;

  // Delete existing decorations
  editor.deltaDecorations(
    editor
      .getModel()
      ?.getAllDecorations()
      .filter((d) => d.options?.className?.startsWith("metric-underline-"))
      .map((d) => d.id) || [],
    [],
  );

  for (const hl of highlights) {
    if (!info.selected.has(hl.metric)) continue;

    if (locationMetricInfo[hl.metric].type === "normal") continue;

    const seg = hl.location;
    const hlClass = "metric-underline-" + locationMetricInfo[hl.metric].type;
    // Create the decoration (highlight)
    editor.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(
            seg.StartLine,
            seg.StartCol,
            seg.EndLine,
            seg.EndCol,
          ),
          options: {
            isWholeLine: false,
            className: hlClass, // CSS class for styling
            glyphMarginClassName: hlClass, // Optional gutter highlight
            hoverMessage: { value: locationMetricInfo[hl.metric].title },
          },
        },
      ],
    );
  }
  // Show the search result
  const seg = info.searchResult?.location;
  if (!seg || seg.File !== currentFile) return;

  const [newId] = info.tabbedEditor.monaco.deltaDecorations(
    [],
    [
      {
        range: new monaco.Range(
          seg.StartLine,
          seg.StartCol,
          seg.EndLine,
          seg.EndCol,
        ),
        options: {
          zIndex: 10, // Show above the normal highlight
          isWholeLine: false,
          className: `metric-search-result`,
        },
      },
    ],
  );
  // Save the location and decoration id for the next search
  info.searchResult = {
    location: seg,
    decorationId: newId,
  };
}
