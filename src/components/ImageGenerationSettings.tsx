import { useMemo, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/useSettings";
import { showError, showSuccess } from "@/lib/toast";
import type {
  UserSettings,
  ImageGenerationProvider,
  ImageGenerationSettings as ImageGenerationSettingsModel,
} from "@/lib/schemas";

const PROVIDERS: Array<{
  id: ImageGenerationProvider;
  label: string;
  getKeyUrl: string;
  description: string;
}> = [
  {
    id: "openai",
    label: "OpenAI",
    getKeyUrl: "https://platform.openai.com/api-keys",
    description: "DALL-E 3 via the OpenAI Images API.",
  },
  {
    id: "stability",
    label: "Stability AI",
    getKeyUrl: "https://platform.stability.ai/account/keys",
    description: "Stable Image Core via Stability's v2beta API.",
  },
];

function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

function nextImageGenerationSettings(
  current: ImageGenerationSettingsModel | undefined,
  patch: Partial<ImageGenerationSettingsModel>,
): ImageGenerationSettingsModel {
  return {
    defaultProvider: patch.defaultProvider ?? current?.defaultProvider,
    openai: patch.openai ?? current?.openai,
    stability: patch.stability ?? current?.stability,
  };
}

export function ImageGenerationSettings() {
  const { settings, updateSettings } = useSettings();
  const imageGeneration = settings?.imageGeneration;

  const [inputs, setInputs] = useState<Record<ImageGenerationProvider, string>>(
    {
      openai: "",
      stability: "",
    },
  );
  const [saving, setSaving] = useState<ImageGenerationProvider | null>(null);
  const [deleting, setDeleting] = useState<ImageGenerationProvider | null>(
    null,
  );

  const savedKeys = useMemo(
    () =>
      ({
        openai: imageGeneration?.openai?.apiKey?.value,
        stability: imageGeneration?.stability?.apiKey?.value,
      }) as Record<ImageGenerationProvider, string | undefined>,
    [imageGeneration],
  );

  const configuredProviders = PROVIDERS.filter((p) => !!savedKeys[p.id]).map(
    (p) => p.id,
  );
  const effectiveDefault: ImageGenerationProvider | undefined =
    imageGeneration?.defaultProvider ?? configuredProviders[0];

  async function saveKey(provider: ImageGenerationProvider) {
    const plain = inputs[provider].trim();
    if (!plain) return;
    setSaving(provider);
    try {
      const patch: Partial<ImageGenerationSettingsModel> = {
        [provider]: { apiKey: { value: plain } },
      };
      const nextSettings: Partial<UserSettings> = {
        imageGeneration: nextImageGenerationSettings(imageGeneration, patch),
      };
      await updateSettings(nextSettings);
      setInputs((prev) => ({ ...prev, [provider]: "" }));
      showSuccess(`${provider} API key saved.`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : `Failed to save ${provider} key.`,
      );
    } finally {
      setSaving(null);
    }
  }

  async function deleteKey(provider: ImageGenerationProvider) {
    setDeleting(provider);
    try {
      const patch: Partial<ImageGenerationSettingsModel> = { [provider]: {} };
      const nextSettings: Partial<UserSettings> = {
        imageGeneration: nextImageGenerationSettings(imageGeneration, patch),
      };
      await updateSettings(nextSettings);
      showSuccess(`${provider} API key removed.`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : `Failed to remove ${provider} key.`,
      );
    } finally {
      setDeleting(null);
    }
  }

  async function setDefaultProvider(provider: ImageGenerationProvider) {
    try {
      await updateSettings({
        imageGeneration: nextImageGenerationSettings(imageGeneration, {
          defaultProvider: provider,
        }),
      });
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to save default provider.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Image Generation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            API keys for the <code>generate_image</code> agent tool.
            Configure at least one provider to enable image generation.
          </p>
        </div>
        {configuredProviders.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="image-generation-default"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Default
            </label>
            <Select
              value={effectiveDefault}
              onValueChange={(v) =>
                v
                  ? setDefaultProvider(v as ImageGenerationProvider)
                  : undefined
              }
            >
              <SelectTrigger className="w-32" id="image-generation-default">
                <SelectValue>{effectiveDefault ?? ""}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {configuredProviders.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const saved = savedKeys[p.id];
          const isSaving = saving === p.id;
          const isDeleting = deleting === p.id;
          const disabled = isSaving || isDeleting;
          return (
            <div
              key={p.id}
              className="rounded-lg border border-border p-3 bg-(--background-lightest) space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4" />
                    {p.label}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {p.description}{" "}
                    <a
                      href={p.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Get key
                    </a>
                  </p>
                </div>
                {saved && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteKey(p.id)}
                    disabled={disabled}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? "Removing…" : "Remove"}
                  </Button>
                )}
              </div>

              {saved ? (
                <p className="font-mono text-xs text-gray-600 dark:text-gray-400">
                  {maskKey(saved)}
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={inputs[p.id]}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder={
                    saved
                      ? `Enter a new ${p.label} key to replace`
                      : `Enter your ${p.label} API key`
                  }
                  className="flex-grow"
                  disabled={disabled}
                />
                <Button
                  onClick={() => saveKey(p.id)}
                  disabled={disabled || !inputs[p.id].trim()}
                >
                  {isSaving ? "Saving…" : saved ? "Replace" : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
