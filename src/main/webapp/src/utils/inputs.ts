import { multipleSelect } from "multiple-select-vanilla";
import { div, el, ElementChild } from "./elements";
import "multiple-select-vanilla/dist/styles/css/multiple-select.css";
import { label } from "./typography";

// For an object type O, return the keys k in O for which O[k]=T
// type TypeKeys<O, T> = { [K in keyof O]: O[K] extends T ? K : never }[keyof O];
type GetSet<T> = [T, (val: T) => void];

// Generate a value and setter for a field of an object
export function getSetField<O, K extends keyof O>(
  object: O,
  field: K,
  after?: (val: O[K]) => void,
): GetSet<O[K]> {
  return [
    (object as any)[field],
    !after
      ? (value) => ((object as any)[field] = value)
      : (value) => {
          (object as any)[field] = value;
          after(value);
        },
  ];
}

// Add a label to some element
export function alignedLabeledElem(
  labelChild: ElementChild,
  fieldElem: HTMLElement,
): HTMLElement {
  if (!fieldElem.id) {
    fieldElem.id = "" + Math.trunc(Math.random() * 1000000);
  }

  const labelElem = label(labelChild, []);
  labelElem.htmlFor = fieldElem.id;

  const labelTd = el("td", "pl-4 pb-2 pr-3", [labelElem]);
  labelTd.style.textAlign = "right";
  labelTd.style.verticalAlign = "middle";

  return el("tr", "", [labelTd, el("td", "pb-2", [fieldElem])]);
}

export function labeledElem(
  labelChild: ElementChild,
  fieldElem: HTMLElement,
): HTMLElement {
  if (!fieldElem.id) {
    fieldElem.id = "" + Math.trunc(Math.random() * 1000000);
  }

  const labelElem = label(labelChild, []);
  labelElem.htmlFor = fieldElem.id;
  return div("", [el("td", "pb-2", [fieldElem]), labelElem]);
}

// Create a button element
export function button(
  className: string,
  child: ElementChild,
  onclick: (e: MouseEvent) => void,
): HTMLButtonElement {
  const buttonElem = el("button", className, [child]);
  buttonElem.addEventListener("click", onclick);
  return buttonElem;
}

// Create a labeled text input element
export function textInput(
  [get, set]: GetSet<string>,
  className?: string,
): HTMLInputElement {
  const fieldElem = el(
    "input",
    className ?? "input size-90",
    [],
    { value: get },
    { width: "20em" },
  );
  fieldElem.addEventListener("input", () => set(fieldElem.value));
  return fieldElem;
}

// Create a labeled text input element
export function textareaInput(
  [get, set]: GetSet<string>,
  className?: string,
): HTMLTextAreaElement {
  const areaElem = el(
    "textarea",
    className ?? "input size-90",
    [],
    { value: get },
    {
      minWidth: "35em",
      maxWidth: "35em",
      minHeight: "2em",
    },
  );
  areaElem.addEventListener("change", () => set(areaElem.value));
  return areaElem;
}

// Create a labeled text input element
export function numericInput(
  [get, set]: GetSet<number>,
  className?: string,
): HTMLInputElement {
  const fieldElem = el(
    "input",
    (className ?? "input size-90") + " pr-0",
    [],
    {
      value: get + "",
      type: "number",
    },
    { maxWidth: "4em" },
  );
  fieldElem.addEventListener("change", () => set(+fieldElem.value));
  return fieldElem;
}

// Wrapper around fieldInput which adds a label and custom formatting.
export function checkboxInput(
  [get, set]: GetSet<boolean>,
  label?: ElementChild,
  options?: { className?: string; disabled?: boolean },
): HTMLElement {
  const checkElem = el(
    "input",
    options?.className ?? "checkbox mr-2 shrink-0",
    [],
    {
      type: "checkbox",
      checked: get,
      disabled: options?.disabled,
    },
  );

  checkElem.addEventListener("change", () => set(checkElem.checked));

  if (label) {
    return el("label", "row align-center gap-1", [checkElem, label]);
  }

  return checkElem;
}

// Wrapper around fieldInput which adds a label and custom formatting.
export function dropdownInput(
  [get, set]: GetSet<string>,
  options: readonly string[],
  className?: string,
): HTMLSelectElement {
  const optionElems = options.map((o) => el("option", "", [o]));
  const selectElem = el(
    "select",
    `${className ?? "size-90"} multiple-select`,
    optionElems,
  );
  selectElem.value = get;

  delayedMultiselectInit();

  selectElem.addEventListener("change", () => set(selectElem.value));
  return selectElem;
}

// Create a dropdown allowing selecting multiple elements
export function multiselectInput(
  [get, set]: GetSet<string[]>,
  options: readonly string[],
  className?: string,
): HTMLSelectElement {
  const optionElems = options.map((o) => el("option", "", [o]));
  const selectElem = el(
    "select",
    `${className ?? "size-90"} multiple-select`,
    optionElems,
  );
  selectElem.multiple = true;

  // Remove any selected values which do not appear in the options list
  const filtered = get.filter((str) => options.includes(str));
  set(filtered);
  // Mark the option elements as selected or not
  for (let i = 0; i < options.length; i++) {
    optionElems[i].selected = filtered.includes(options[i]);
  }

  selectElem.addEventListener("change", () => {
    set(Array.from(selectElem.selectedOptions, (opt) => opt.value));
  });

  delayedMultiselectInit();

  return selectElem;
}

// Create an input for lists of strings
export function listInput([get, set]: GetSet<string[]>, onCommit?: () => void): HTMLElement {
  const initialVal = get;

  const countElem = div("ml-2 is-size-7");

  const fieldElem = el(
    "input",
    "input size-90",
    [],
    { value: initialVal.join(",") },
    {
      minWidth: "35em",
      maxWidth: "35em",
    },
  );

  function oninput() {
    const strings = fieldElem.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    set(strings);
    countElem.innerText = `Total: ${strings.length}`;
  }
  countElem.innerText = `Total: ${initialVal.length}`;
  fieldElem.addEventListener("input", oninput);
  if (onCommit) fieldElem.addEventListener("change", onCommit);

  return div("", [fieldElem, countElem]);
}

// Create an input for lists of lists of strings (comma separated)
export function listListInput([get, set]: GetSet<string[][]>): HTMLElement {
  const initialVal = get;

  const countsElem = div("ml-2 is-size-7");

  const fieldElem = el("textarea", "input size-90") as HTMLTextAreaElement;
  fieldElem.value = initialVal.map((grp) => grp.join(",")).join("\n");
  fieldElem.style.minWidth = "35em";
  fieldElem.style.maxWidth = fieldElem.style.minWidth;
  fieldElem.style.minHeight = "4em";

  function onchange() {
    const grid = fieldElem.value
      .split("\n")
      .map((line) =>
        line
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
      )
      .filter((list) => list.length > 0);
    set(grid);

    const total = grid.reduce((acc, g) => acc + g.length, 0);
    countsElem.innerText = `Groups: ${grid.length}, Total: ${total}`;
  }
  onchange();
  fieldElem.addEventListener("input", onchange);

  return div("", [fieldElem, countsElem]);
}

// Create a radio button input
export function radioButtonInput<T>(
  [get, set]: GetSet<T>,
  options: [T, string][],
  className?: string,
) {
  const category = Math.trunc(Math.random() * 10e8).toString();
  return div(
    `control ${className ?? ""}`,
    options.map(([value, label]) => {
      const input = el("input", "", [], {
        type: "radio",
        name: category,
        checked: value == get,
      });
      input.addEventListener("change", () => set(value));
      return div(
        "",
        el("label", "", [input, el("span", "pl-1 size-80", label)]),
      );
    }),
  );
}

// Create a radio input styled as side-by-side buttons
type ButtonIcon = ElementChild;
type MultibuttonProps = {
  className?: string;
  buttonClass?: string;
  gap?: number;
  padding?: number;
  horizontal?: boolean;
  iconPos?: "above";
};
export function multiButtonInput<T>(
  [get, set]: GetSet<T>,
  options: NoInfer<readonly (readonly [T, string, ButtonIcon])[]>,
  props: MultibuttonProps = {},
) {
  const category = Math.trunc(Math.random() * 10e8).toString();
  const gap = props.gap ?? 2;
  return div(
    `multibutton control gap-1 ${props.horizontal ? "row" : "col"} ${props.className ?? ""}`,
    options.map(([value, label, icon]) => {
      const inputElem = el("input", "border-1", [], {
        type: "radio",
        name: category,
        checked: value == get,
        hidden: true,
      });
      inputElem.addEventListener("change", () => set(value));
      if (props.iconPos === "above") {
        return el(
          "label",
          `text-center mx-${gap} p-${props.padding ?? 2} col align-center border-1 round-1 ${props.buttonClass ?? ""}`,
          [inputElem, icon ? div("pb-1", icon) : "", div("size-80", label)],
        );
      }

      return el(
        "label",
        `${props.horizontal ? "text-center" : ""} mx-${gap} p-${props.padding ?? 2} row align-center border-1 round-1 ${props.buttonClass ?? ""}`,
        [inputElem, icon ? div("pr-2 row", icon) : "", div("size-80", label)],
      );
    }),
  );
}

// Perform extra initialization for multiple-select-vanilla
var multiselectTimer: NodeJS.Timeout | null = null;
function delayedMultiselectInit() {
  if (multiselectTimer) clearTimeout(multiselectTimer);
  setTimeout(multiselectInit, 1);
}

function multiselectInit() {
  multipleSelect(".multiple-select", {
    // multiple: true,
    selectAll: false,
    multipleWidth: undefined,
    width: 200,
    // position: "bottom",
  });
  // This allows the user to click on the space after the label text
  // to select an item
  document.querySelectorAll(".ms-drop label").forEach((label) => {
    label.addEventListener("click", (e) => e.stopPropagation());
  });
}
