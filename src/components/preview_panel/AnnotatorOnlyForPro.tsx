import { Wrench, ArrowLeft } from "lucide-react";

interface AnnotatorOnlyForProProps {
  onGoBack: () => void;
}

/**
 * Fork placeholder for the screenshot annotator.
 *
 * The original FSL-licensed Annotator was removed when the src/pro/ carve-out
 * was excised from this fork. A clean-room replacement will land in a later
 * phase; until then, the preview annotation path simply shows this "coming
 * soon" panel.
 */
export const AnnotatorOnlyForPro = ({ onGoBack }: AnnotatorOnlyForProProps) => {
  return (
    <div className="w-full h-full bg-background relative">
      <button
        onClick={onGoBack}
        className="absolute top-4 left-4 p-2 hover:bg-accent rounded-md transition-all z-10 group"
        aria-label="Go back"
      >
        <ArrowLeft
          size={20}
          className="text-foreground/70 group-hover:text-foreground transition-colors"
        />
      </button>

      <div className="flex flex-col items-center justify-center h-full px-8">
        <Wrench size={72} className="text-primary/60 dark:text-primary/70 mb-8" />
        <h2 className="text-3xl font-semibold text-foreground mb-4 text-center">
          Annotator coming soon
        </h2>
        <p className="text-muted-foreground mb-10 text-center max-w-md text-base leading-relaxed">
          The screenshot annotator is being rebuilt for this fork. Use the
          preview and chat together in the meantime.
        </p>
      </div>
    </div>
  );
};
