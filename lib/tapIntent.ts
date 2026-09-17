/**
 * "Did a finger mean to open this, or to follow it?" — shared by the header's dropdowns
 * (`components/layout/Navbar.tsx`) and the direction pills on the home page.
 *
 * Pure: no `"use client"`, no DOM. The caller records the pointer type of the press
 * (`onPointerDown`) and hands it over with the click.
 */

/**
 * Should a click on a link be swallowed so its first tap reveals something instead of
 * navigating? Only for the FIRST tap of a touch or pen on a target that `hasChildren` — the
 * target has something a first tap reveals: a dropdown, or a preview (a direction pill's
 * model). A finger has no hover, so without this the dropdown or the preview could never be
 * seen before the link followed its href. The second tap (already opened by a tap)
 * navigates. A mouse (it hovers) and the keyboard (focus opens it) always navigate.
 *
 * `openedByTap` is deliberately "opened by an earlier tap", not "visible": a tap focuses
 * the link on Chromium Android, so the dropdown is already visible through focus-within by
 * the time the click lands — that must still count as the first tap.
 */
export function shouldInterceptTap({
  hasChildren,
  pointerType,
  openedByTap,
}: {
  hasChildren: boolean;
  pointerType: string;
  openedByTap: boolean;
}): boolean {
  return hasChildren && !openedByTap && (pointerType === "touch" || pointerType === "pen");
}

/** A pointer with no hover: a finger or a pen. */
export function isTouchLike(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}
