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
  WebSearchProvider,
  WebSearchSettings as WebSearchSettingsModel,
} from "@/lib/schemas";

const PROVIDERS: Array<{
  id: WebSearchProvider;
  label: string;
  getKeyUrl: string;
  description: string;
}> = [
  {
    id: "tavily",
    label: "Tavily",
    getKeyUrl: "https://app.tavily.com",
    description: "LLM-optimised search; good default choice.",
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    getKeyUrl: "https://www.firecrawl.dev",
    description: "Search + structured crawl from the same vendor.",
  },
  {
    id: "exa",
    label: "Exa",
    getKeyUrl: "https://dashboard.exa.ai",
    description: "Neural search with semantic matching.",
  },
];

function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

/**
 * Builds the next `webSearch` settings object to send to
 * `setUserSettings`. Because the IPC handler does a shallow top-level
 * merge, the whole `webSearch` sub-object has to be re-sent on every
 * update so we don't clobber sibling providers' keys.
 */
function nextWebSearchSettings(
  current: WebSearchSettingsModel | undefined,
  patch: Partial<WebSearchSettingsModel>,
): WebSearchSettingsModel {
  return {
    defaultProvider: patch.defaultProvider ?? current?.defaultProvider,
    tavily: patch.tavily ?? current?.tavily,
    firecrawl: patch.firecrawl ?? current?.firecrawl,
    exa: patch.exa ?? current?.exa,
  };
}

export function WebSearchSettings() {
  const { settings, updateSettings } = useSettings();
  const webSearch = settings?.webSearch;

  const [inputs, setInputs] = useState<Record<WebSearchProvider, string>>({
    tavily: "",
    firecrawl: "",
    exa: "",
  });
  const [saving, setSaving] = useState<WebSearchProvider | null>(null);
  const [deleting, setDeleting] = useState<WebSearchProvider | null>(null);

  const savedKeys = useMemo(
    () =>
      ({
        tavily: webSearch?.tavily?.apiKey?.value,
        firecrawl: webSearch?.firecrawl?.apiKey?.value,
        exa: webSearch?.exa?.apiKey?.value,
      }) as Record<WebSearchProvider, string | undefined>,
    [webSearch],
  );

  const configuredProviders = PROVIDERS.filter((p) => !!savedKeys[p.id]).map(
    (p) => p.id,
  );
  const effectiveDefault: WebSearchProvider | undefined =
    webSearch?.defaultProvider ?? configuredProviders[0];

  async function saveKey(provider: WebSearchProvider) {
    const plain = inputs[provider].trim();
    if (!plain) return;
    setSaving(provider);
    try {
      const patch: Partial<WebSearchSettingsModel> = {
        [provider]: { apiKey: { value: plain } },
      };
      const nextSettings: Partial<UserSettings> = {
        webSearch: nextWebSearchSettings(webSearch, patch),
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

  async function deleteKey(provider: WebSearchProvider) {
    setDeleting(provider);
    try {
      const patch: Partial<WebSearchSettingsModel> = { [provider]: {} };
      const nextSettings: Partial<UserSettings> = {
        webSearch: nextWebSearchSettings(webSearch, patch),
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

  async function setDefaultProvider(provider: WebSearchProvider) {
    try {
      await updateSettings({
        webSearch: nextWebSearchSettings(webSearch, {
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
            Web Search
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            API keys for the <code>web_search</code> agent tool. Configure at
            least one provider to enable web search.
          </p>
        </div>
        {configuredProviders.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="web-search-default"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Default
            </label>
            <Select
              value={effectiveDefault}
              onValueChange={(v) =>
                v ? setDefaultProvider(v as WebSearchProvider) : undefined
              }
            >
              <SelectTrigger className="w-32" id="web-search-default">
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
