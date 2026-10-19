import { div, el, ElementChild } from "./elements";

export function label(
  content: ElementChild,
  child: ElementChild,
  className?: string,
): HTMLLabelElement {
  return el("label", "", [
    div("pb-1 is-size-7 has-text-weight-medium " + className, content),
    child,
  ]);
}

export function semibold(text: ElementChild): HTMLElement {
  return el("span", "has-text-weight-semibold", text);
}

export function italic(text: ElementChild): HTMLElement {
  return el("span", "is-italic", text);
}

export function h1(className: string, text: ElementChild): HTMLElement {
  return el("h1", `is-size-4 has-text-weight-semibold ${className}`, text);
}

export function h2(className: string, text: ElementChild): HTMLElement {
  return el("h2", `is-size-5 has-text-weight-semibold ${className}`, text);
}

export function h3(className: string, text: ElementChild): HTMLElement {
  return el("h3", `is-size-6 has-text-weight-semibold ${className}`, text);
}

export function h4(className: string, text: ElementChild): HTMLElement {
  return el("h4", `is-size-7 has-text-weight-semibold ${className}`, text);
}
