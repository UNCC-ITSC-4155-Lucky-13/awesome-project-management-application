"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const previousUserId = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const preferences = api.user.getPreferences.useQuery(undefined, {
    enabled: userId !== undefined,
  });
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    if (previousUserId.current !== userId) {
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey.some(
            (key) =>
              Array.isArray(key) &&
              key[0] === "user" &&
              key[1] === "getPreferences",
          ),
      });
      previousUserId.current = userId;
      setTheme("system");
    }
  }, [queryClient, userId]);

  useEffect(() => {
    if (preferences.data?.theme) {
      setTheme(preferences.data.theme);
    }
  }, [preferences.data?.theme]);

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return <>{children}</>;
}
