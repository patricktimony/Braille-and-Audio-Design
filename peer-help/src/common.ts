// Small helpers shared by every page.

import "./styles.css";

/**
 * Announces a message to screen readers through the page's status region,
 * and optionally shows the same text visibly next to the control it is about.
 */
export function announce(message: string, visibleTarget?: HTMLElement | null): void {
  const region = document.getElementById("status");
  if (region) {
    // Clearing first makes repeated identical messages announce again.
    region.textContent = "";
    window.setTimeout(() => (region.textContent = message), 100);
  }
  if (visibleTarget) visibleTarget.textContent = message;
}

/** Moves focus to an element (usually a heading) so screen readers read from there. */
export function moveFocusTo(el: HTMLElement | null): void {
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus();
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/**
 * Creates an element. Text is always set with textContent, never as HTML,
 * so text typed by people can never inject markup.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(typeof c === "string" ? document.createTextNode(c) : c);
  return el;
}

export function queryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** Shows an error message on a form field in a way screen readers report. */
export function showFieldError(field: HTMLElement, errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
  field.setAttribute("aria-invalid", "true");
  field.focus();
}

export function clearFieldError(field: HTMLElement, errorEl: HTMLElement): void {
  errorEl.textContent = "";
  errorEl.hidden = true;
  field.removeAttribute("aria-invalid");
}

/**
 * A two-step confirmation shown in the page: the trigger reveals a question
 * with Yes and No buttons, and focus moves to the question so it is read.
 */
export function confirmOnPage(
  trigger: HTMLElement,
  panel: HTMLElement,
  question: HTMLElement,
  yes: HTMLElement,
  no: HTMLElement,
  onYes: () => void,
): void {
  trigger.addEventListener("click", () => {
    panel.hidden = false;
    trigger.hidden = true;
    question.focus();
  });
  no.addEventListener("click", () => {
    panel.hidden = true;
    trigger.hidden = false;
    trigger.focus();
    announce("Nothing was deleted.");
  });
  yes.addEventListener("click", onYes);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
