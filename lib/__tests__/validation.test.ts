import { describe, it, expect } from "vitest";
import {
  LIMITS,
  required,
  maxLen,
  isEmail,
  isPhone,
  hasDangerousContent,
  sanitizeText,
  sanitizeLink,
  isLink,
  validateText,
} from "@/lib/validation";

describe("LIMITS", () => {
  it("mirrors the documented backend limits", () => {
    expect(LIMITS).toEqual({
      name: 120,
      email: 254,
      phone: 40,
      message: 5000,
      short: 200,
      long: 2000,
      link: 500,
    });
  });
});

describe("required", () => {
  it("is true for non-empty (post-trim) values", () => {
    expect(required("hello")).toBe(true);
    expect(required("  x  ")).toBe(true);
  });

  it("is false for empty / whitespace-only values", () => {
    expect(required("")).toBe(false);
    expect(required("   ")).toBe(false);
    expect(required("\t\n")).toBe(false);
  });
});

describe("maxLen", () => {
  it("counts trimmed length", () => {
    expect(maxLen("abc", 3)).toBe(true);
    expect(maxLen("  abc  ", 3)).toBe(true); // trims to 3
    expect(maxLen("abcd", 3)).toBe(false);
    expect(maxLen("", 0)).toBe(true);
  });
});

describe("isEmail", () => {
  it("accepts plausible addresses", () => {
    for (const v of [
      "user@example.com",
      "a.b@sub.domain.ro",
      "name+tag@host.io",
      "  spaced@trim.com  ",
    ]) {
      expect(isEmail(v)).toBe(true);
    }
  });

  it("rejects malformed addresses", () => {
    for (const v of [
      "",
      "plainstring",
      "no@dot",
      "@nolocal.com",
      "spaces in@mail.com",
      "two@@at.com",
      "trailing@dot.",
    ]) {
      expect(isEmail(v)).toBe(false);
    }
  });
});

describe("isPhone", () => {
  it("accepts permissive phone formats with >= 6 chars", () => {
    for (const v of [
      "+373 600 00 000",
      "0600-00-000",
      "(022) 22 33 44",
      "123456",
      "  +40 712 345 678 ",
    ]) {
      expect(isPhone(v)).toBe(true);
    }
  });

  it("rejects too-short or letter-containing values", () => {
    for (const v of ["12345", "", "phone", "12a456", "++"]) {
      expect(isPhone(v)).toBe(false);
    }
  });
});

describe("hasDangerousContent", () => {
  it("flags <script> tags", () => {
    expect(hasDangerousContent("<script>alert(1)</script>")).toBe(true);
    expect(hasDangerousContent("hi <SCRIPT src=x>")).toBe(true);
  });

  it("flags javascript: URIs (case-insensitive)", () => {
    expect(hasDangerousContent("javascript:alert(1)")).toBe(true);
    expect(hasDangerousContent("JavaScript:void(0)")).toBe(true);
  });

  it("flags on*= event handlers", () => {
    expect(hasDangerousContent('onclick=alert(1)')).toBe(true);
    expect(hasDangerousContent('onerror = "x"')).toBe(true);
    expect(hasDangerousContent("onload=doThing()")).toBe(true);
  });

  it("flags raw HTML tags", () => {
    expect(hasDangerousContent("<b>bold</b>")).toBe(true);
    expect(hasDangerousContent("<img src=x>")).toBe(true);
    expect(hasDangerousContent("a </div> b")).toBe(true);
  });

  it("passes clean text and empty input", () => {
    expect(hasDangerousContent("")).toBe(false);
    expect(hasDangerousContent("Bună ziua, vreau un site.")).toBe(false);
    expect(hasDangerousContent("cost < 500 lei > buget")).toBe(false); // no tag-like token
    expect(hasDangerousContent("email: a@b.ro, tel 060")).toBe(false);
  });
});

describe("sanitizeText", () => {
  it("strips HTML tags", () => {
    expect(sanitizeText("<b>hi</b> there")).toBe("hi there");
    expect(sanitizeText("<img src=x>text")).toBe("text");
  });

  it("strips javascript: URIs and on*= handlers", () => {
    expect(sanitizeText("javascript:alert(1)")).toBe("alert(1)");
    expect(sanitizeText("onclick=boom")).toBe("boom");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeText("   hello   ")).toBe("hello");
  });

  it("is idempotent (sanitizing twice equals once)", () => {
    const inputs = [
      "<script>bad</script> ok",
      "  <b>x</b> javascript:go ",
      "clean text",
      "onmouseover=hi <span>yo</span>",
    ];
    for (const v of inputs) {
      const once = sanitizeText(v);
      expect(sanitizeText(once)).toBe(once);
    }
  });
});

describe("validateText", () => {
  const label = "Numele";

  it("returns null for an accepted required value", () => {
    expect(validateText("Ana Pop", { label, max: LIMITS.name, required: true })).toBeNull();
  });

  it("empty optional fields pass immediately (null)", () => {
    expect(validateText("", { label, max: LIMITS.name })).toBeNull();
    expect(validateText("   ", { label, max: LIMITS.name })).toBeNull();
  });

  it("empty required fields fail with the required message", () => {
    expect(validateText("", { label, max: LIMITS.name, required: true })).toBe(
      "Numele este obligatoriu.",
    );
  });

  it("checks required BEFORE dangerous (empty required wins even if it were dangerous)", () => {
    // A whitespace-only value is empty post-trim, so required fires, not dangerous.
    expect(
      validateText("   ", { label, max: LIMITS.name, required: true }),
    ).toBe("Numele este obligatoriu.");
  });

  it("checks length BEFORE dangerous", () => {
    // Value is both over-length AND dangerous; length message must win now
    // (length is checked before the dangerous-content regexes).
    const long = "<script>" + "a".repeat(LIMITS.name + 50);
    expect(validateText(long, { label, max: LIMITS.name })).toBe(
      "Numele depășește 120 de caractere.",
    );
  });

  it("checks length BEFORE format (email)", () => {
    // Over-length but also not a valid email: length message must win.
    const long = "x".repeat(LIMITS.email + 1);
    expect(
      validateText(long, { label: "Emailul", max: LIMITS.email, email: true }),
    ).toBe(`Emailul depășește ${LIMITS.email} de caractere.`);
  });

  it("returns the length message when over max", () => {
    const over = "a".repeat(LIMITS.short + 1);
    expect(validateText(over, { label: "Serviciul", max: LIMITS.short })).toBe(
      "Serviciul depășește 200 de caractere.",
    );
  });

  it("validates email format when the rule is set", () => {
    expect(
      validateText("not-an-email", { label: "Emailul", max: LIMITS.email, email: true }),
    ).toBe("Introdu o adresă de email validă.");
    expect(
      validateText("a@b.ro", { label: "Emailul", max: LIMITS.email, email: true }),
    ).toBeNull();
  });

  it("validates phone format only when non-empty", () => {
    expect(
      validateText("12345", { label: "Telefonul", max: LIMITS.phone, phone: true }),
    ).toBe("Introdu un număr de telefon valid.");
    expect(
      validateText("+373 600 00 000", { label: "Telefonul", max: LIMITS.phone, phone: true }),
    ).toBeNull();
    // Empty optional phone passes (format not checked).
    expect(
      validateText("", { label: "Telefonul", max: LIMITS.phone, phone: true }),
    ).toBeNull();
  });

  it("flags dangerous content in an otherwise-valid short value", () => {
    expect(
      validateText("Ok <b>bold</b>", { label: "Mesajul", max: LIMITS.message }),
    ).toBe("Mesajul conține caractere sau cod nepermis.");
  });
});

describe("isLink", () => {
  it("accepts an empty value (links are optional)", () => {
    expect(isLink("")).toBe(true);
    expect(isLink("   ")).toBe(true);
  });

  it("accepts site-relative paths and absolute http(s) URLs", () => {
    expect(isLink("/partners/crowe.png")).toBe(true);
    expect(isLink("/api/uploads/abc123.png")).toBe(true);
    expect(isLink("https://crowe-tm.md")).toBe(true);
    expect(isLink("http://cgam.md/logo.png")).toBe(true);
  });

  it("rejects dangerous schemes", () => {
    expect(isLink("javascript:alert(1)")).toBe(false);
    expect(isLink("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
    expect(isLink("vbscript:msgbox(1)")).toBe(false);
    expect(isLink("file:///etc/passwd")).toBe(false);
  });

  it("rejects protocol-relative URLs and non-http schemes", () => {
    expect(isLink("//evil.example/logo.png")).toBe(false);
    expect(isLink("ftp://evil.example/logo.png")).toBe(false);
  });

  it("rejects characters that could break out of an href/src attribute", () => {
    expect(isLink('https://ok.md/a.png" onerror="alert(1)')).toBe(false);
    expect(isLink("https://ok.md/<script>")).toBe(false);
  });

  it("rejects an over-long link", () => {
    expect(isLink(`https://ok.md/${"a".repeat(LIMITS.link)}`)).toBe(false);
  });
});

describe("sanitizeLink", () => {
  it("trims an acceptable link", () => {
    expect(sanitizeLink("  https://crowe-tm.md  ")).toBe("https://crowe-tm.md");
  });

  it("drops an unacceptable link entirely rather than patching it up", () => {
    // Rewriting would leave a live `alert(1)` behind — so the value is dropped.
    expect(sanitizeLink("javascript:alert(1)")).toBe("");
    expect(sanitizeLink("//evil.example/x.png")).toBe("");
  });
});

describe("validateText with the link rule", () => {
  const rules = { label: "Site-ul", max: LIMITS.link, link: true };

  it("passes a valid link and an empty optional one", () => {
    expect(validateText("https://turcan.md", rules)).toBeNull();
    expect(validateText("", rules)).toBeNull();
  });

  it("reports a malformed link", () => {
    expect(validateText("evil.example", rules)).toBe(
      "Introdu un link valid (https://… sau o cale care începe cu /).",
    );
  });
});
