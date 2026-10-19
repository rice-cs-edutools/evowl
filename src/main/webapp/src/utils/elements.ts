/*
 * This file provides helper functions for creating HTML elements.
 */

export type ElementChild =
  | Element
  | string
  | number
  | null
  | boolean
  | undefined
  | ElementChild[];

function childToNodes(child: ElementChild): (string | Node)[] {
  if (child === undefined || child === null || child === false) {
    return [];
  } else if (child instanceof Array) {
    return child.flatMap(childToNodes);
  } else if (typeof child == "number" || child === true) {
    return [child.toString()];
  } else {
    return [child];
  }
}

type ElementTag = keyof HTMLElementTagNameMap;
type ElementType<T extends ElementTag> = HTMLElementTagNameMap[T];
type ElementProps<T extends ElementTag> = Partial<ElementType<T>>;
type StyleProps = Partial<HTMLElement["style"]>;

/*
 * This is a helper function allowing for creation of arbitrary HTML elements.
 * TAG is the HTML tag that the element will be created with.
 * CLASSNAME is a space-delimited list of class names.
 * CHILDREN is a list of objects to be used as child nodes.
 * PROPS specifies a list of properties to apply to the element.
 */
export function el<T extends ElementTag>(
  tag: T,
  className?: string,
  child?: ElementChild,
  props?: ElementProps<T>,
  style?: StyleProps,
): ElementType<T> {
  const elem = document.createElement(tag) as ElementType<T>;
  if (className) elem.className = className;
  // Add the children to the element
  elem.append(...childToNodes(child));
  // Apply the properties to the element
  Object.assign(elem, props ?? {});
  // Apply the style property,
  Object.assign(elem.style, style ?? {});
  return elem;
}

export function htmlEl(html: string): HTMLElement {
  const elem = document.createElement("div");
  elem.innerHTML = html;
  return elem;
}

/*
 * Since most elements are divs, this provides a helper to `el` which
 * automatically sets the type to div.
 */
export function div(
  className?: string,
  child?: ElementChild,
  props?: ElementProps<"div">,
  style?: StyleProps,
): HTMLElement {
  return el("div", className, child, props, style);
}

export function span(
  className?: string,
  child?: ElementChild,
  props?: ElementProps<"div">,
  style?: StyleProps,
): HTMLElement {
  return el("span", className, child, props, style);
}

/*
 * Create a textarea element which dynamically resizes to the size of
 * the text inside of it.
 */
export function textarea(
  className?: string,
  initial?: string,
): HTMLTextAreaElement {
  const area = el("textarea", className, [], {
    value: initial ?? "",
    rows: 1,
  });
  area.addEventListener("input", () => {
    area.style.height = "auto";
    area.style.height = area.scrollHeight + "px";
  });
  return area;
}

/*
 * Create a table element
 */
export function table(className: string, elems: ElementChild[][]): HTMLElement {
  return el(
    "table",
    className,
    elems.map((row) =>
      el(
        "tr",
        "",
        row.map((cell) => el("td", "", [cell])),
      ),
    ),
  );
}
