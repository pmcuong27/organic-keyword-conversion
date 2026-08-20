"use client";

import { useMemo, useState } from "react";
import { savePropertyMapping } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/dashboard/searchable-select";

type Ga4Option = {
  propertyId: string;
  displayName: string;
  account: string;
};

type ExistingPair = {
  gscSiteUrl: string;
  ga4PropertyId: string;
};

function pairingKey(gscSiteUrl: string, ga4PropertyId: string) {
  return `${gscSiteUrl}::${ga4PropertyId}`;
}

export function ConnectAccountsForm({
  gscSites,
  ga4Properties,
  existingPairs = [],
  submitLabel = "Save pairing",
  nextPath = "/dashboard",
}: {
  gscSites: string[];
  ga4Properties: Ga4Option[];
  existingPairs?: ExistingPair[];
  submitLabel?: string;
  nextPath?: string;
}) {
  const existingKeys = useMemo(
    () => new Set(existingPairs.map((p) => pairingKey(p.gscSiteUrl, p.ga4PropertyId))),
    [existingPairs],
  );

  const unusedGsc = useMemo(
    () =>
      gscSites.filter(
        (site) =>
          !ga4Properties.every((p) => existingKeys.has(pairingKey(site, p.propertyId))),
      ),
    [gscSites, ga4Properties, existingKeys],
  );

  const [gscSiteUrl, setGscSiteUrl] = useState(unusedGsc[0] ?? gscSites[0] ?? "");
  const [ga4PropertyId, setGa4PropertyId] = useState("");

  const ga4Items = useMemo(
    () =>
      ga4Properties.map((p) => {
        const alreadyPaired =
          !!gscSiteUrl && existingKeys.has(pairingKey(gscSiteUrl, p.propertyId));
        return {
          value: p.propertyId,
          label: p.displayName,
          hint: `${p.account} · ${p.propertyId}${alreadyPaired ? " · already paired" : ""}`,
          group: p.account,
          disabled: alreadyPaired,
        };
      }),
    [ga4Properties, gscSiteUrl, existingKeys],
  );

  const availableGa4 = ga4Items.filter((item) => !item.disabled);
  const resolvedGa4Id =
    ga4PropertyId && availableGa4.some((item) => item.value === ga4PropertyId)
      ? ga4PropertyId
      : (availableGa4[0]?.value ?? "");

  const selectedGa4 = useMemo(
    () => ga4Properties.find((p) => p.propertyId === resolvedGa4Id),
    [ga4Properties, resolvedGa4Id],
  );

  const alreadyExists =
    !!gscSiteUrl &&
    !!resolvedGa4Id &&
    existingKeys.has(pairingKey(gscSiteUrl, resolvedGa4Id));

  const defaultName = selectedGa4
    ? selectedGa4.displayName
    : gscSiteUrl.replace(/^https?:\/\//, "") || "New client";

  return (
    <form action={savePropertyMapping} className="space-y-4">
      <input type="hidden" name="ga4DisplayName" value={selectedGa4?.displayName ?? ""} />
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="gscSiteUrl" value={gscSiteUrl} />
      <input type="hidden" name="ga4PropertyId" value={resolvedGa4Id} />

      <div className="space-y-2">
        <Label htmlFor="gscSiteUrl">Google Search Console site</Label>
        <SearchableSelect
          id="gscSiteUrl"
          items={gscSites.map((site) => ({ value: site, label: site }))}
          value={gscSiteUrl}
          onValueChange={(site) => {
            setGscSiteUrl(site);
            setGa4PropertyId("");
          }}
          placeholder="Select a Search Console site"
          searchPlaceholder="Search sites…"
          emptyText="No Search Console sites found for this Google account."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ga4PropertyId">GA4 property</Label>
        <SearchableSelect
          id="ga4PropertyId"
          items={ga4Items}
          value={resolvedGa4Id}
          onValueChange={setGa4PropertyId}
          placeholder="Select a GA4 property"
          searchPlaceholder="Search properties or accounts…"
          emptyText="No unmatched GA4 properties for this site."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Client / pairing name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          key={`${gscSiteUrl}-${resolvedGa4Id}-${defaultName}`}
          placeholder="Acme — website"
        />
        <p className="text-xs text-muted-foreground">
          Shown in the header switcher. Use a client name so agencies can tell pairings apart.
        </p>
      </div>

      {alreadyExists ? (
        <p className="text-sm text-muted-foreground">
          This Search Console site and GA4 property are already paired. Saving will update the
          name.
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={!gscSiteUrl || !resolvedGa4Id}>
        {alreadyExists ? "Update pairing name" : submitLabel}
      </Button>
    </form>
  );
}
