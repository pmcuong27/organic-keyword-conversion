import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { AppHeader } from "@/components/dashboard/app-header";
import { getDataSourceInfo, getLastSyncAt } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getDashboardContext();

  if (ctx.mode === "live" && ctx.userId && ctx.properties.length === 0) {
    redirect("/onboarding");
  }

  const propertyId = ctx.property?.id ?? null;
  const [lastSyncedAt, source] = await Promise.all([
    getLastSyncAt(propertyId),
    getDataSourceInfo(propertyId),
  ]);

  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="h-14 border-b border-border" />}>
            <AppHeader
              lastSyncedAt={lastSyncedAt}
              dataMode={source.mode}
              properties={ctx.properties}
              selectedPropertyId={propertyId}
            />
          </Suspense>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
