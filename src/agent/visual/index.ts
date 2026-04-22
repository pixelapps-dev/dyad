/**
 * Visual-editing scaffolding for the fork.
 *
 * Upstream shipped two visual features under the FSL-licensed `src/pro/`:
 *
 *   1. **Theme picker** — already lives in `src/shared/themes.ts` and
 *      `src/hooks/useThemes.ts` under Apache-2.0. Nothing was removed
 *      with the `src/pro/` carve-out, so no re-implementation is
 *      needed; the picker UI is rendered from
 *      `src/components/chat/AuxiliaryActionsMenu.tsx`.
 *
 *   2. **Screenshot / DOM annotator** — a click-to-select overlay on
 *      top of the preview iframe that pushed `ComponentSelection`
 *      objects into the chat input. That lived at
 *      `src/pro/ui/components/Annotator/` and was cut. The UI slot is
 *      held today by the "Annotator coming soon" placeholder at
 *      `src/components/preview_panel/AnnotatorOnlyForPro.tsx`.
 *
 * This file exists so future annotator work has a clear home. It
 * defines the postMessage protocol the iframe-side script and the
 * Electron renderer will use once the clean-room annotator lands.
 *
 * When implementing, create alongside this file:
 *
 *   iframe_client.ts   — runs inside the preview; adds hover/click
 *                        listeners and postMessage to the parent on
 *                        selection.
 *   annotator.ts       — renderer-side listener; consumes the above
 *                        messages and writes into
 *                        `selectedComponentsPreviewAtom`.
 *   Annotator.tsx      — React component replacing
 *                        `AnnotatorOnlyForPro`; renders an overlay,
 *                        the selection chip list, and a "Done" button
 *                        that closes the picker.
 */

/**
 * Protocol version stamped on every message so the iframe script and
 * the renderer can refuse each other when they get out of sync (e.g.
 * after an upgrade).
 */
export const VISUAL_EDITING_PROTOCOL_VERSION = 1 as const;

/** Messages the iframe-side script emits to the parent window. */
export type FromIframeMessage =
  | {
      type: "dyad-visual:ready";
      protocol: typeof VISUAL_EDITING_PROTOCOL_VERSION;
    }
  | {
      type: "dyad-visual:element-selected";
      protocol: typeof VISUAL_EDITING_PROTOCOL_VERSION;
      element: {
        /** Stable id for dedupe across multiple selections. */
        id: string;
        /** Human-readable tag, e.g. "button.primary". */
        name: string;
        /** File path of the React component, from the build's sourcemap. */
        relativePath?: string;
        /** 1-based line number in the source file. */
        lineNumber?: number;
        /** Runtime element identifier, used to re-focus after hot reload. */
        runtimeId?: string;
        /** Inner text excerpt (<=120 chars) for display. */
        textPreview?: string;
      };
    };

/** Messages the parent sends into the iframe. */
export type ToIframeMessage =
  | {
      type: "dyad-visual:enter-select-mode";
      protocol: typeof VISUAL_EDITING_PROTOCOL_VERSION;
    }
  | {
      type: "dyad-visual:exit-select-mode";
      protocol: typeof VISUAL_EDITING_PROTOCOL_VERSION;
    }
  | {
      type: "dyad-visual:highlight";
      protocol: typeof VISUAL_EDITING_PROTOCOL_VERSION;
      elementId: string;
      runtimeId?: string;
    };

export function isFromIframeMessage(value: unknown): value is FromIframeMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; protocol?: unknown };
  if (v.protocol !== VISUAL_EDITING_PROTOCOL_VERSION) return false;
  return (
    v.type === "dyad-visual:ready" ||
    v.type === "dyad-visual:element-selected"
  );
}
