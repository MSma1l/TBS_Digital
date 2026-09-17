import { describe, expect, it } from "vitest";
import { ATTACHMENT_MAX, attachmentBlock } from "@/lib/request/attachment";
import type { RequestAttachment } from "@/lib/request/RequestFlowProvider";

/*
 * The block a HUD tool hands over with a request (lib/request/attachment.ts), as the estimator
 * writes it into the message. The tool builds the text; this is where the dialog makes sure
 * that text can neither get the request refused (control characters: the API answers 422) nor
 * eat the visitor's own summary (the cap).
 */

const calc = (text: string, extra: Partial<RequestAttachment> = {}): RequestAttachment => ({
  kind: "calculator",
  count: 2,
  text,
  ...extra,
});

const BLOCK = "CALCULATOR DE COST:\n- Landing page (landing): de la 150€\n- CRM personalizat (crm): de la 450€";

describe("attachmentBlock", () => {
  it("is empty when nothing was attached", () => {
    expect(attachmentBlock(undefined)).toBe("");
  });

  it("is empty when the attachment has no text left to send", () => {
    expect(attachmentBlock(calc(""))).toBe("");
    expect(attachmentBlock(calc("  \n\t "))).toBe("");
    expect(attachmentBlock(calc("\x00\x07\x1b"))).toBe("");
    // A caller outside the type system (a stale chunk, a cast) gets nothing, not a throw.
    expect(attachmentBlock({ kind: "builder", count: 1, text: 42 } as unknown as RequestAttachment)).toBe("");
  });

  it("writes the tool's text as it is, whatever the count or summary say", () => {
    expect(attachmentBlock(calc(BLOCK))).toBe(BLOCK);
    expect(attachmentBlock(calc(BLOCK, { kind: "builder", count: 99, summary: "de la 600€" }))).toBe(BLOCK);
  });

  it("trims the whitespace around the block, so it never adds blank lines to the message", () => {
    expect(attachmentBlock(calc(`\n\n  ${BLOCK}  \n`))).toBe(BLOCK);
  });

  it("strips the control characters the API refuses, and keeps tab and line breaks", () => {
    const dirty = "CALCULATOR\x00 DE COST:\x07\n- Landing\x1b page\x7f\t(landing)\r\n- CRM\x0b\x0c";
    expect(attachmentBlock(calc(dirty))).toBe("CALCULATOR DE COST:\n- Landing page\t(landing)\r\n- CRM");
    // The same class as backend/app/validators.py _CONTROL_RE: nothing of it survives.
    expect(attachmentBlock(calc(dirty))).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/);
  });

  it("keeps a block of exactly ATTACHMENT_MAX characters whole", () => {
    const exact = "x".repeat(ATTACHMENT_MAX);
    expect(ATTACHMENT_MAX).toBe(1200);
    expect(attachmentBlock(calc(exact))).toBe(exact);
  });

  it("cuts a longer block to ATTACHMENT_MAX and marks the cut", () => {
    const long = `${BLOCK}\n${"- Serviciu: de la 150€\n".repeat(200)}`;
    const block = attachmentBlock(calc(long));
    expect(block.length).toBeLessThanOrEqual(ATTACHMENT_MAX);
    expect(block.startsWith(BLOCK)).toBe(true);
    expect(block.endsWith("\n[…]")).toBe(true);
  });

  it("counts the cap after stripping, so a dirty block that fits once cleaned is not cut", () => {
    const text = "y".repeat(ATTACHMENT_MAX);
    const dirty = text.split("").join("\x01");
    expect(attachmentBlock(calc(dirty))).toBe(text);
  });

  it("never splits an emoji at the cut", () => {
    // 1195 characters, then emoji: the cut at 1196 would fall between a surrogate pair.
    const text = `${"z".repeat(ATTACHMENT_MAX - 5)}${"🧩".repeat(20)}`;
    const block = attachmentBlock(calc(text));
    expect(block.length).toBeLessThanOrEqual(ATTACHMENT_MAX);
    expect(block.endsWith("\n[…]")).toBe(true);
    const body = block.slice(0, -"\n[…]".length);
    const lastCode = body.charCodeAt(body.length - 1);
    expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);
    expect(body).toBe("z".repeat(ATTACHMENT_MAX - 5));
  });
});
