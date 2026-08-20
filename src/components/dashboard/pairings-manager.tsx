"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  deletePropertyAction,
  selectPropertyAction,
  setDefaultPropertyAction,
} from "@/app/actions/account";
import type { PropertyOption } from "@/lib/properties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PairingsManager({
  pairings,
  selectedPropertyId,
}: {
  pairings: PropertyOption[];
  selectedPropertyId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refreshAfter(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (!pairings.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No client pairings yet. Add a Search Console site and GA4 property below.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pairings.map((pairing) => {
        const selected = pairing.id === selectedPropertyId;
        return (
          <div
            key={pairing.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">{pairing.name}</p>
                {selected ? <Badge>Selected</Badge> : null}
                {pairing.isDefault ? (
                  <Badge variant="secondary">Default</Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                GSC {pairing.gscSiteUrl}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                GA4 {pairing.ga4DisplayName || pairing.ga4PropertyId} ({pairing.ga4PropertyId})
              </p>
              <p className="text-xs text-muted-foreground">
                {pairing.lastSyncedAt
                  ? `Last synced ${formatDistanceToNow(pairing.lastSyncedAt, { addSuffix: true })}`
                  : "Not synced yet"}
                {" · "}
                {pairing.timezone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!selected ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => refreshAfter(() => selectPropertyAction(pairing.id))}
                >
                  Switch to
                </Button>
              ) : null}
              {!pairing.isDefault ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => refreshAfter(() => setDefaultPropertyAction(pairing.id))}
                >
                  Set default
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove “${pairing.name}”? Cached Search Console and GA4 rows for this pairing will be deleted.`,
                    )
                  ) {
                    return;
                  }
                  refreshAfter(() => deletePropertyAction(pairing.id));
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
