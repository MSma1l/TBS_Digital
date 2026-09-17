import type { RequestAttachment } from "@/lib/request/RequestFlowProvider";

/**
 * The block a HUD tool hands over with a request, as it goes into the sent message.
 *
 * The calculator and the builder write their own text (`RequestAttachment.text`) in their own
 * chunk at handoff time, so the dialog never has to fetch that code to send. This is the
 * dialog's side of the contract, and it trusts nothing about the text:
 *
 *   - control characters are stripped — the API refuses a `message` carrying any
 *     (`backend/app/validators.py` `_CONTROL_RE`, the same class), and one stray byte in a
 *     service name must not turn the whole request into a 422;
 *   - the block is capped at `ATTACHMENT_MAX`, with the visible `[…]` mark the estimator uses,
 *     so an attachment can never crowd the visitor's own summary out of the 5000-character
 *     message.
 */

/** Longest attachment block written into the message, marker included. */
export const ATTACHMENT_MAX = 1200;

/** Same mark `Estimator.tsx` leaves where the cap cut a block short. */
const TRUNCATED = "\n[…]";

/** C0 controls and DEL, except tab, line feed and carriage return — mirrors the API. */
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/**
 * The attachment's block — or "" when there is none, or nothing is left of it once cleaned.
 *
 * A cut never splits a surrogate pair: half an emoji is not valid Unicode, and the backend
 * could not encode it for Telegram.
 */
export function attachmentBlock(a: RequestAttachment | undefined): string {
  if (!a || typeof a.text !== "string") return "";
  const text = a.text.replace(CONTROL_RE, "").trim();
  if (text.length <= ATTACHMENT_MAX) return text;
  let end = ATTACHMENT_MAX - TRUNCATED.length;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1; // a high surrogate whose pair was cut off
  return `${text.slice(0, end).trimEnd()}${TRUNCATED}`;
}
