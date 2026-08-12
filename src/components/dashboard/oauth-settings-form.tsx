"use client";

import { useState, useTransition } from "react";
import { generateAuthSecretAction, saveOauthSettings } from "@/app/actions/oauth-settings";
import type { OauthPublicConfig } from "@/lib/oauth-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/dashboard/help-tip";

export function OauthSettingsForm({ initial }: { initial: OauthPublicConfig }) {
  const [pending, startTransition] = useTransition();
  const [authSecret, setAuthSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectUri = `${(initial.authUrl || "http://localhost:3000").replace(/\/$/, "")}/api/auth/callback/google`;

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await saveOauthSettings(formData);
          if (result.ok) {
            setAuthSecret("");
            setMessage("Saved. You can sign in with Google from the login page. Refresh if the button does not appear yet.");
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="authUrl" className="inline-flex items-center gap-1">
          App URL
          <HelpTip label="About app URL">
            The address of this app. Locally use http://localhost:3000. In production use your https domain, with no trailing slash.
          </HelpTip>
        </Label>
        <Input
          id="authUrl"
          name="authUrl"
          defaultValue={initial.authUrl}
          placeholder="http://localhost:3000"
        />
      </div>

      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1">
          Redirect URI
          <HelpTip label="About redirect URI">
            Paste this into Google Cloud → Credentials → your OAuth Web client → Authorized redirect URIs. Also add the origin (for example http://localhost:3000) under Authorized JavaScript origins.
          </HelpTip>
        </Label>
        <Input readOnly value={redirectUri} className="bg-muted font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="authSecret" className="inline-flex items-center gap-1">
            Auth secret
            <HelpTip label="About auth secret">
              A random string this app uses to sign sessions. Generate one here. It is not from Google.
            </HelpTip>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              startTransition(async () => {
                setAuthSecret(await generateAuthSecretAction());
              });
            }}
          >
            Generate
          </Button>
        </div>
        <Input
          id="authSecret"
          name="authSecret"
          type="password"
          autoComplete="new-password"
          value={authSecret}
          onChange={(e) => setAuthSecret(e.target.value)}
          placeholder={initial.authSecretSet ? "Saved — leave blank to keep" : "Generate or paste a secret"}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="googleClientId" className="inline-flex items-center gap-1">
          Google client ID
          <HelpTip label="About Google client ID">
            From Google Cloud → APIs & Services → Credentials → OAuth client ID. Application type must be Web application, not Desktop.
          </HelpTip>
        </Label>
        <Input
          id="googleClientId"
          name="googleClientId"
          defaultValue={initial.googleClientId}
          placeholder="123456789-abc.apps.googleusercontent.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="googleClientSecret" className="inline-flex items-center gap-1">
          Google client secret
          <HelpTip label="About Google client secret">
            Shown once when you create the Web client, or via the client’s Edit screen. Leave blank to keep a secret that is already saved.
          </HelpTip>
        </Label>
        <Input
          id="googleClientSecret"
          name="googleClientSecret"
          type="password"
          autoComplete="new-password"
          placeholder={
            initial.googleClientSecretSet ? "Saved — leave blank to keep" : "GOCSPX-..."
          }
        />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border p-3">
        <input
          id="enableLiveGoogle"
          name="enableLiveGoogle"
          type="checkbox"
          defaultChecked
          className="mt-1"
        />
        <Label htmlFor="enableLiveGoogle" className="font-normal leading-snug">
          Turn on Google sign-in for this app (sets DEMO_MODE and USE_OFFLINE_DB off). You will
          need Postgres running for live GSC/GA4 sync.
        </Label>
      </div>
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Google sign-in"}
      </Button>
    </form>
  );
}
