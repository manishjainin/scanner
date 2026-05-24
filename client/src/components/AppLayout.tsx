import { Link, useLocation } from "wouter";
import { Plane, LayoutDashboard, Settings, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col"
        style={{ background: "oklch(0.12 0.01 260)" }}>
        {/* Logo */}
        <div className="px-5 py-6 border-b border-border">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))" }}>
                <Plane className="w-4.5 h-4.5 text-black" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Ministry Of Travel</p>
                <p className="text-xs text-muted-foreground">Flight Scanner</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div className={`sidebar-nav-item ${isActive ? "active" : ""}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-border">
          {isAuthenticated && user ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{user.name ?? "User"}</p>
                  {isAdmin && (
                    <p className="text-xs" style={{ color: "oklch(0.78 0.15 75)" }}>Admin</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => void logout()}
                className="sidebar-nav-item w-full text-left"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Sign out
              </button>
            </div>
          ) : (
            <a href={getLoginUrl()} className="sidebar-nav-item block">
              <LogIn className="w-4 h-4 flex-shrink-0" />
              Sign in
            </a>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
