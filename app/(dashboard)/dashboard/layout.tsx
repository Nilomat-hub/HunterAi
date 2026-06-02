import Link from "next/link";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { ClipboardCheck, Home, KeyRound, ListFilter, MessageCircle, Send, Settings, UserCircle } from "lucide-react";
import { authOptions } from "@/lib/auth/options";

const navItems = [
  { href: "/dashboard", label: "Übersicht", icon: Home },
  { href: "/dashboard/search-profiles", label: "Suchprofile", icon: ListFilter },
  { href: "/dashboard/listings", label: "Inserate", icon: Home },
  { href: "/dashboard/applications", label: "Bewerbungen", icon: Send },
  { href: "/dashboard/telegram", label: "Telegram", icon: MessageCircle },
  { href: "/dashboard/portal-accounts", label: "Portal-Konten", icon: KeyRound },
  { href: "/dashboard/setup", label: "Setup", icon: ClipboardCheck },
  { href: "/dashboard/settings", label: "Einstellungen", icon: Settings }
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white lg:block">
        <div className="flex h-16 items-center border-b px-5 font-semibold">Apartment Hunter AI</div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm hover:bg-secondary"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="font-semibold">Dashboard</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserCircle className="h-4 w-4" />
            {session?.user?.email}
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-white px-3 py-2 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm hover:bg-secondary"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
