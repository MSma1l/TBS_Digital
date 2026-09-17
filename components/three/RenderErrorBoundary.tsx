"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type RenderErrorBoundaryProps = {
  /** Called once, after the failed subtree has been replaced by nothing. */
  onError: (error: unknown) => void;
  children?: ReactNode;
};

type RenderErrorBoundaryState = { failed: boolean };

/**
 * Decoration must never take the page down: whatever throws inside a 3D subtree — a chunk
 * that fails to load, a WebGL renderer that can't be created, a shader that won't compile, a
 * token three can't parse — renders nothing from the moment it fails and tells the owner,
 * who decides what "failed" means there: the intro shell gets the page out from under the
 * overlay, the intro director drops back to the SVG ∞, the interior stage keeps its art.
 *
 * A class because error boundaries still have no hook form in React 19.
 */
export class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  state: RenderErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RenderErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    void info;
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
