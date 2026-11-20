"use client";

import { useEffect, useState } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { Typography } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type Theme = "light" | "dark" | "system";

const choices: {
  value: Theme;
  label: string;
  description: string;
  icon: typeof SunIcon;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Use a light appearance.",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use a dark appearance.",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device appearance.",
    icon: MonitorIcon,
  },
];

export function PreferencesForm() {
  const utils = api.useUtils();
  const preferences = api.user.getPreferences.useQuery();
  const updatePreferences = api.user.updatePreferences.useMutation({
    onSuccess: async (updated) => {
      setSelectedTheme(updated.theme);
      await utils.user.getPreferences.invalidate();
    },
  });
  const [selectedTheme, setSelectedTheme] = useState<Theme>("system");

  useEffect(() => {
    if (preferences.data?.theme) {
      setSelectedTheme(preferences.data.theme);
    }
  }, [preferences.data?.theme]);

  const saveTheme = (theme: Theme) => {
    updatePreferences.mutate({ theme });
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <Typography variant="h1">Preferences</Typography>
        <Typography variant="subtitle">
          Customize how BetterJira looks for you.
        </Typography>
      </div>
      <Card>
        <CardHeader>
          <Typography variant="h2">Appearance</Typography>
          <Typography variant="caption">
            Choose the appearance used across the application.
          </Typography>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {preferences.isPending && (
            <Typography variant="caption" className="sm:col-span-3">
              Loading your appearance preference...
            </Typography>
          )}
          {choices.map(({ value, label, description, icon: Icon }) => {
            const selected = selectedTheme === value;
            return (
              <Button
                key={value}
                type="button"
                variant="outline"
                disabled={preferences.isPending || updatePreferences.isPending}
                aria-pressed={selected}
                onClick={() => saveTheme(value)}
                className={cn(
                  "h-auto min-h-32 flex-col items-start justify-between gap-4 p-4 text-left",
                  selected && "border-primary ring-primary/20 ring-2",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <Icon aria-hidden="true" />
                  {selected && <CheckIcon aria-label="Selected" />}
                </span>
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="text-muted-foreground">{description}</span>
                </span>
              </Button>
            );
          })}
        </CardContent>
        {(preferences.isError || updatePreferences.isError) && (
          <Typography variant="caption" className="text-destructive px-6 pb-6">
            Unable to save your appearance preference. Please try again.
          </Typography>
        )}
      </Card>
    </main>
  );
}
