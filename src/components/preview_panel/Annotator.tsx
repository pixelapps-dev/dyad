import { useState } from "react";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showError } from "@/lib/toast";

interface AnnotatorProps {
  screenshotDataUrl: string;
  onGoBack: () => void;
  onAttach: (file: File) => void;
}

/**
 * Clean-room replacement for the upstream (FSL) screenshot annotator.
 *
 * v1 is deliberately minimal: show the screenshot and offer an
 * "Attach to chat" button that converts the data URL into a real
 * `File` and hands it off to the existing chat-attachments pipeline.
 * A drawing / pin-marker layer can land later without changing the
 * public contract (`onAttach` stays the same — later we'd wrap the
 * screenshot in a canvas, flatten markers onto it, and hand over the
 * composited PNG).
 */
export function Annotator({
  screenshotDataUrl,
  onGoBack,
  onAttach,
}: AnnotatorProps) {
  const [attaching, setAttaching] = useState(false);

  async function attachToChat() {
    setAttaching(true);
    try {
      const response = await fetch(screenshotDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `preview-${Date.now()}.png`, {
        type: blob.type || "image/png",
      });
      onAttach(file);
      onGoBack();
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Failed to attach preview screenshot to chat.",
      );
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="w-full h-full bg-background relative flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={onGoBack}
          className="p-1.5 hover:bg-accent rounded-md transition-all"
          aria-label="Close annotator"
        >
          <ArrowLeft size={18} className="text-foreground/70" />
        </button>
        <div className="flex-1" />
        <Button
          onClick={attachToChat}
          disabled={attaching}
          size="sm"
          className="gap-1.5"
        >
          {attaching ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Camera size={14} />
          )}
          {attaching ? "Attaching…" : "Attach to chat"}
        </Button>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <img
          src={screenshotDataUrl}
          alt="Preview screenshot"
          className="max-w-full h-auto rounded-md shadow-sm border border-border"
        />
      </div>

      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        Attach this screenshot to your next chat message so the model can see
        what you're looking at. Drawing / pin tools land in a follow-up.
      </div>
    </div>
  );
}
