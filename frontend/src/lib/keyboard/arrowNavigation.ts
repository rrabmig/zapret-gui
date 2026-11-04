import type { KeyboardEvent } from "react";

/** Arrow keys complement native Tab/Enter/Space without changing navigation semantics. */
export function arrowNavigation(
  event: KeyboardEvent<HTMLElement>,
  activate = false,
) {
  const keys = [
    "ArrowDown",
    "ArrowUp",
    "ArrowRight",
    "ArrowLeft",
    "Home",
    "End",
  ];
  if (
    !keys.includes(event.key) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const buttons = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  ].filter((button) => button.getClientRects().length > 0);
  const current = buttons.indexOf(
    (event.target as Element).closest("button") as HTMLButtonElement,
  );
  if (current < 0 || !buttons.length) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (current +
            (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) +
            buttons.length) %
          buttons.length;
  buttons[next].focus();
  if (activate) buttons[next].click();
}
