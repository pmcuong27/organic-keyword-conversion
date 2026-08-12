"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { syncSelectedPropertyAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SyncLast24HoursButton({
  disabled,
  size = "default",
  variant = "default",
  className,
  showStatus = true,
  onError,
}: {
  disabled?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "outline";
  className?: string;
  showStatus?: boolean;
  onError?: (error: string | null) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function onClick() {
    setError(null);
    setSummary(null);
    onError?.(null);
    startTransition(async () => {
      const result = await syncSelectedPropertyAction("24h");
      if (result && "error" in result && result.error) {
        setError(result.error);
        onError?.(result.error);
        return;
      }
      if (result?.ok) {
        setSummary(
          `Downloaded ${result.gscRows.toLocaleString()} Search Console rows and ${result.ga4Rows.toLocaleString()} GA4 rows.`,
        );
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", "24h");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  return (
    <div className={cn(showStatus ? "space-y-2" : undefined)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("gap-1.5", className)}
        onClick={onClick}
        disabled={disabled || pending}
      >
        <Download className={`size-3.5 ${pending ? "animate-pulse" : ""}`} />
        {pending ? "Downloading…" : "Download last 24 hours"}
      </Button>
      {showStatus && error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {showStatus && summary ? (
        <p className="text-sm text-muted-foreground">{summary}</p>
      ) : null}
    </div>
  );
}
