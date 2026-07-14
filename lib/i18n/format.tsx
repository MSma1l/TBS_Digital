import { Fragment, type ReactNode } from "react";

/**
 * Fill `{name}`-style placeholders in a catalog string. Values are coerced to strings.
 *   format("de la {price}", { price: "€500" }) -> "de la €500"
 */
export function format(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/**
 * Render a catalog string that contains `\n` line breaks as real <br> breaks — used for
 * headings the design splits across two lines (e.g. "Servicii de\ndigitalizare").
 */
export function Multiline({ text }: { text: string }): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}
