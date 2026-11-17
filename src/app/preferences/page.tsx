import { redirect } from "next/navigation";

import { getSession } from "@/server/better-auth/server";
import { PreferencesForm } from "./_components/preferences-form";

export default async function PreferencesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?callbackUrl=%2Fpreferences");
  }

  return <PreferencesForm />;
}
