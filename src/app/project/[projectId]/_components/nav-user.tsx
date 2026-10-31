"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { authClient } from "@/server/better-auth/client";
import { ChevronUpIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function getUserInitials(name: string | null | undefined) {
  const initials = name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials?.length ? initials : "?";
}

export async function signOutAndRedirect(redirect: () => void) {
  await authClient.signOut();
  redirect();
}

export function NavUser() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const user = session?.user;

  if (isPending) {
    return (
      <div className="bg-sidebar-accent/50 h-12 animate-pulse rounded-md" />
    );
  }

  if (!user) {
    return <div className="h-12" aria-hidden="true" />;
  }

  const displayName = user.name ?? user.email;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(false);

    try {
      await signOutAndRedirect(() => router.push("/"));
    } catch (error) {
      console.error("Unable to sign out.", error);
      setSignOutError(true);
      setIsSigningOut(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="lg"
                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-12 w-full justify-start rounded-md p-2 text-left"
                aria-label={`Open account menu for ${displayName}`}
              />
            }
          >
            <Avatar size="sm">
              {user.image && (
                <AvatarImage src={user.image} alt={`${displayName}'s avatar`} />
              )}
              <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{displayName}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {user.email}
              </span>
            </span>
            <ChevronUpIcon className="ml-auto size-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  {user.image && (
                    <AvatarImage
                      src={user.image}
                      alt={`${displayName}'s avatar`}
                    />
                  )}
                  <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{displayName}</p>
                  <p className="text-muted-foreground truncate text-xs font-normal">
                    {user.email}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <SettingsIcon />
                Preferences / Account Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isSigningOut}
              onClick={handleSignOut}
            >
              <LogOutIcon />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </DropdownMenuItem>
            {signOutError && (
              <p className="text-destructive px-1.5 py-1 text-xs">
                Sign out failed. Please try again.
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
