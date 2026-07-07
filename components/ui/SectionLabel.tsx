import type { ReactNode } from "react";

/** Mono index label used at the top of every section, e.g. "/02  PRINCIPIILE NOASTRE". */
export function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <div className="sectionLabel">
      <span className="idx">{index}</span>
      &nbsp;&nbsp;{children}
    </div>
  );
}
