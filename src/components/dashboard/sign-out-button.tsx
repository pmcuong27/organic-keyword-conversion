"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      className={cn(
        "w-full justify-start gap-3 text-muted-foreground",
        collapsed && "justify-center px-0",
      )}
      onClick={() => {
        startTransition(async () => {
          try {
            await signOutAction();
          } catch {
            // redirect() throws; if it does not, force a full navigation
          }
          window.location.assign("/login");
        });
      }}
    >
      <LogOut className="size-4 shrink-0" />
      {!collapsed && <span>{pending ? "Signing out…" : "Sign out"}</span>}
    </Button>
  );
}
