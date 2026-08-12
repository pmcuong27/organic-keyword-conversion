import { Suspense } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { AppHeader } from "@/components/dashboard/app-header";
import { getDataSourceInfo, getLastSyncAt } from "@/lib/data-blending";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lastSyncedAt, source] = await Promise.all([
    getLastSyncAt(null),
    getDataSourceInfo(),
  ]);

  return (
    <TooltipProvider>
      <div className="flex min-h-svh bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="h-14 border-b border-border" />}>
            <AppHeader lastSyncedAt={lastSyncedAt} dataMode={source.mode} />
          </Suspense>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
