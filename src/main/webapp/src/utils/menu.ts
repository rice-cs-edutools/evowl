import { el, ElementChild } from "./elements";

/*
 * Create a menu for choosing between pages
 */
function menuItem(
  label: string,
  icon: string,
  onclick: () => void,
): HTMLElement {
  const iconElem = el("span", "mr-3 icon is-left", [el("i", icon)]);
  return el("a", "panel-block", [iconElem, label], { onclick: onclick });
}

export function createMenuedPage(
  heading: ElementChild,
  pages: [string, string, HTMLElement | (() => void)][],
): HTMLElement {
  const pageElems = pages
    .map(([, , el]) => el)
    .filter((el): el is HTMLElement => el instanceof HTMLElement);

  const menuBlockElems = <HTMLElement[]>[];
  let current = 0;

  // Generate a list of functions for selecting a particular menu item
  const onSelects = pages.map(([, , onclick], idx) => () => {
    menuBlockElems[current].classList.remove("is-active");
    menuBlockElems[idx].classList.add("is-active");
    current = idx;

    // Hide all elements
    pageElems.forEach((el) => (el.hidden = true));
    if (onclick instanceof HTMLElement) {
      onclick.hidden = false;
    } else {
      onclick();
    }
  });

  // Create the menu options
  menuBlockElems.push(
    ...pages.map(([label, icon], idx) => menuItem(label, icon, onSelects[idx])),
  );

  // Select the first menu item
  onSelects[current]();

  return el("div", "menu", [
    el("article", "menu-panel panel is-dark", [
      el("p", "panel-heading", [heading]),
      ...menuBlockElems,
    ]),
    el("div", "menu-page", pageElems),
  ]);
}
