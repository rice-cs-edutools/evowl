/*
 * This file defines an accordion element, which can be opened and
 * closed when clicking the header.
 */

import { div, el, ElementChild } from "./elements";

/*
 * The accordion info struct holds enough information to control the
 * opening/closing of the accordion.
 */
export type AccordionInfo = {
  element: HTMLElement;
  body: HTMLElement;
  controlId: string | null;
  time: number;
  timer?: NodeJS.Timeout;
  hook?: (b: boolean) => void;
};

/*
 * Close an accordion.
 */
export function accordionClose(info: AccordionInfo) {
  if (info.timer) {
    clearTimeout(info.timer);
    info.timer = undefined;
  }

  info.element.classList.remove("accordion-open");

  info.body.style.maxHeight = info.body.scrollHeight + "px";
  info.body.style.overflow = "hidden";
  setTimeout(() => {
    info.body.style.maxHeight = "0px";
  }, 0);

  info.hook?.call(undefined, false);
}

export function accordionCloseById(controlid: string) {
  const others = document.getElementsByClassName(
    `accordion-header-id:${controlid}`,
  );
  for (let i = 0; i < others.length; i++) {
    const otherInfo = (others[i] as AccordionHeaderElem).accordionInfo;
    if (otherInfo.element.classList.contains("accordion-open")) {
      accordionClose(otherInfo);
    }
  }
}

/*
 * Open an accordion
 */
export function accordionOpen(info: AccordionInfo, instant: boolean = false) {
  if (info.timer) {
    clearTimeout(info.timer);
    info.timer = undefined;
  }

  // Hide all other accordions
  if (info.controlId != null) {
    const others = document.getElementsByClassName(
      `accordion-header-id:${info.controlId}`,
    );
    for (let i = 0; i < others.length; i++) {
      const otherInfo = (others[i] as AccordionHeaderElem).accordionInfo;
      if (
        otherInfo != info &&
        otherInfo.element.classList.contains("accordion-open")
      ) {
        accordionClose(otherInfo);
      }
    }
  }

  // Show this accordion
  info.element.classList.add("accordion-open");
  info.body.style.maxHeight = info.body.scrollHeight + "px";

  // Delete the max height property in a sec
  info.timer = setTimeout(
    () => {
      info.body.style.maxHeight = "fit-content";
      info.body.style.overflow = "visible";
    },
    instant ? 0 : info.time * 1000,
  );

  info.hook?.call(undefined, true);
}

/*
 * The accordion header element must know the AccordionInfo so that click
 * events can perform opening and closing.
 */
type AccordionHeaderElem = HTMLElement & { accordionInfo: AccordionInfo };
type AccordionBodyElem = HTMLElement & { accordionInfo: AccordionInfo };

/*
 * This function will be called when the accordion header is clicked
 * in order to perform the opening/closing of the accordion.
 */
function accordionHeaderOnclick() {
  const headerElem = this as AccordionHeaderElem;
  const info = headerElem.accordionInfo;
  if (info.element.classList.contains("accordion-open")) {
    accordionClose(info);
  } else {
    accordionOpen(info);
  }
}

/*
 * Generate a folding accordion element.
 * HEADER will always be shown, and can be clicked on to toggle the accordion.
 * BODY will be toggled open and closed when the header is clicked.
 *
 * If CONTROLID is a string, then any time another accordion with the
 * same id is opened, this accordion will be closed (only one
 * accordion of each id can be open at a time.) If it is null, then
 * this accordion will not be controlled by any other accordions.
 */
export function accordion(
  header: ElementChild,
  body: ElementChild,
  controlId?: string | null,
  open?: boolean,
  hook?: (b: boolean) => void,
  withInfo?: (i: AccordionInfo) => void,
): HTMLElement {
  // Create an element containing the body
  const bodyElem = div("accordion-body", div("", body)) as AccordionBodyElem;

  // Create the header element with an arrow on the right side which
  // shows whether the accordion is open
  const headerElem = el(
    "a",
    "color-inherit accordion-header row w-100 justify-between",
    [
      header,
      div(
        "accordion-arrow-container",
        el("i", "fas fa-chevron-right accordion-arrow", []),
      ),
    ],
  ) as HTMLElement as AccordionHeaderElem;
  headerElem.addEventListener("click", accordionHeaderOnclick);

  const accordionElem = div("accordion", [headerElem, bodyElem]);

  // Add the accordion info to the header element
  const info = {
    element: accordionElem,
    body: bodyElem,
    controlId: controlId ?? null,
    time: 0.35,
    hook: hook,
  };
  headerElem.accordionInfo = info;
  bodyElem.accordionInfo = info;
  bodyElem.style.transition = `max-height ${info.time}s ease-out`;

  // Add the id to the accordion element
  if (typeof controlId == "string") {
    headerElem.classList.add(`accordion-header-id:${controlId}`);
  }

  // Maybe open the accordion elem
  if (open) {
    // Wait until the page is loaded so that the body gets the correct height
    accordionElem.classList.add("accordion-open");
  } else {
    accordionClose(info);
    bodyElem.style.maxHeight = "0";
  }

  withInfo?.(info);

  return accordionElem;
}
