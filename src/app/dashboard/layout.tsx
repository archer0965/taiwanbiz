import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <DashboardNav />
      <div className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
