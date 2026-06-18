import BottomNav from "@/components/shared/BottomNav";
import TopBar from "@/components/shared/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
