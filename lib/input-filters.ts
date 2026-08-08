"use client";

import * as React from "react";

// ============================================================================
// Input filtering.
//
// WHY THIS EXISTS: schema validation (lib/validations/booking.ts) runs on
// SUBMIT. That is the correct place for the authoritative check, but it means
// a customer can type letters into a phone field, fill in the rest of the
// form, and only discover the problem when they press the button. Filtering at
// the keystroke lets the field refuse the character outright, so the error
// never happens.
//
// These are two independent layers, not alternatives:
//
//   filtering  — guides input, improves the experience, trivially bypassable
//   schema     — authoritative, runs on submit, also enforced server-side
//
// Filtering is deliberately NOT treated as a security control. Anything typed
// here can be bypassed by disabling JavaScript or posting directly to the API,
// which is exactly why every one of these fields is also validated in the Zod
// schema and re-validated on the server.
//
// PASTE IS HANDLED TOO: blocking keystrokes alone leaves an obvious hole —
// pasting bypasses onKeyDown entirely. Rather than blocking paste (hostile to
// anyone pasting a number from their contacts), the pasted text is cleaned and
// inserted, so "+1 (868) 490-0175" becomes usable rather than rejected.
// ============================================================================

/** Keys that must always work regardless of the filter. */
const ALWAYS_ALLOWED = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "Home",
  "End",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

function isEditingShortcut(e: React.KeyboardEvent): boolean {
  // Ctrl/Cmd combinations: copy, paste, cut, select-all, undo, redo.
  return e.ctrlKey || e.metaKey;
}

/**
 * Builds handlers that restrict a text input to characters matching `allow`.
 *
 * @param allow      Regex tested against each single typed character.
 * @param sanitise   Cleans pasted text. Defaults to stripping anything that
 *                   fails `allow`.
 */
export function useFilteredInput(
  allow: RegExp,
  sanitise?: (text: string) => string
) {
  const clean = React.useCallback(
    (text: string) =>
      sanitise
        ? sanitise(text)
        : text
            .split("")
            .filter((ch) => allow.test(ch))
            .join(""),
    [allow, sanitise]
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (ALWAYS_ALLOWED.has(e.key) || isEditingShortcut(e)) return;
      // Ignore non-character keys (F1, Shift, etc.) — they have multi-char names.
      if (e.key.length !== 1) return;
      if (!allow.test(e.key)) {
        e.preventDefault();
      }
    },
    [allow]
  );

  const onPaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData("text");
      const cleaned = clean(pasted);

      // Nothing usable in the clipboard — swallow the paste rather than
      // inserting junk.
      if (!cleaned) {
        e.preventDefault();
        return;
      }

      // Only intervene when cleaning actually changed something; otherwise let
      // the browser handle it natively so undo history stays intact.
      if (cleaned === pasted) return;

      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + cleaned + el.value.slice(end);

      // Set the value through the native setter so React's onChange fires and
      // react-hook-form sees the update. Assigning el.value directly would
      // update the DOM but leave form state stale.
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(el, next);
      el.dispatchEvent(new Event("input", { bubbles: true }));

      const caret = start + cleaned.length;
      el.setSelectionRange(caret, caret);
    },
    [clean]
  );

  return { onKeyDown, onPaste };
}

// --- Shared character classes -----------------------------------------------

/**
 * Phone: digits, spaces, and the punctuation people naturally type.
 *
 * The leading "+" is allowed even though the country selector supplies the
 * dial code, because pasting a full international number is common and
 * lib/phone.ts already handles a duplicated country code correctly.
 */
export const PHONE_CHARS = /[0-9+\-\s()]/;

/**
 * Names: letters in any script, plus the punctuation real names contain —
 * O'Brien, Jean-Luc, Ali ibn Saud. Digits and symbols are refused.
 */
export const NAME_CHARS = /[\p{L}\s'’.-]/u;

/**
 * Driving permit: alphanumerics, hyphens, spaces.
 *
 * Deliberately permissive on letters: overseas licence and IDP numbers
 * routinely mix letters and digits, so restricting to digits would lock out
 * the visitors this field exists to accommodate.
 */
export const PERMIT_CHARS = /[A-Za-z0-9\s-]/;
