"use client";

import { useMemo, useState } from "react";
import { savePropertyMapping } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Ga4Option = {
  propertyId: string;
  displayName: string;
  account: string;
};

export function ConnectAccountsForm({
  gscSites,
  ga4Properties,
  submitLabel = "Save pairing",
}: {
  gscSites: string[];
  ga4Properties: Ga4Option[];
  submitLabel?: string;
}) {
  const [gscSiteUrl, setGscSiteUrl] = useState(gscSites[0] ?? "");
  const [ga4PropertyId, setGa4PropertyId] = useState(ga4Properties[0]?.propertyId ?? "");

  const selectedGa4 = useMemo(
    () => ga4Properties.find((p) => p.propertyId === ga4PropertyId),
    [ga4Properties, ga4PropertyId],
  );

  const defaultName = selectedGa4
    ? `${selectedGa4.displayName}`
    : gscSiteUrl || "My property";

  return (
    <form action={savePropertyMapping} className="space-y-4">
      <input type="hidden" name="ga4DisplayName" value={selectedGa4?.displayName ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="gscSiteUrl">Google Search Console site</Label>
        <Select value={gscSiteUrl} onValueChange={setGscSiteUrl}>
          <SelectTrigger id="gscSiteUrl" className="w-full">
            <SelectValue placeholder="Select a Search Console site" />
          </SelectTrigger>
          <SelectContent>
            {gscSites.map((site) => (
              <SelectItem key={site} value={site}>
                {site}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="gscSiteUrl" value={gscSiteUrl} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ga4PropertyId">GA4 property</Label>
        <Select value={ga4PropertyId} onValueChange={setGa4PropertyId}>
          <SelectTrigger id="ga4PropertyId" className="w-full">
            <SelectValue placeholder="Select a GA4 property" />
          </SelectTrigger>
          <SelectContent>
            {ga4Properties.map((p) => (
              <SelectItem key={p.propertyId} value={p.propertyId}>
                {p.account} — {p.displayName} ({p.propertyId})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="ga4PropertyId" value={ga4PropertyId} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" defaultValue={defaultName} key={defaultName} />
      </div>

      <Button type="submit" className="w-full" disabled={!gscSiteUrl || !ga4PropertyId}>
        {submitLabel}
      </Button>
    </form>
  );
}
