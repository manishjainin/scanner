import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Plane, LayoutDashboard, Settings, LogOut, User, Menu, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LocalLoginForm } from "@/components/LocalLoginForm";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" onClick={onNavigate}>
          <div className="flex items-center gap-3 cursor-pointer">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))" }}
            >
              <Plane style={{ width: 18, height: 18, color: "oklch(0.10 0.01 260)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Ministry of Travel</p>
              <p className="text-xs text-muted-foreground">Flight Scanner</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
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
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{user.name ?? "User"}</p>
                {isAdmin && (
                  <p className="text-xs" style={{ color: "oklch(0.78 0.15 75)" }}>Admin</p>
                )}
              </div>
            </div>
            <button onClick={() => void logout()} className="sidebar-nav-item w-full text-left">
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Sign out
            </button>
          </div>
        ) : (
          <LocalLoginForm compact />
        )}
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-60 flex-shrink-0 border-r border-border flex-col"
        style={{ background: "oklch(0.12 0.01 260)" }}
      >
        <SidebarInner />
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar (slide-in drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border transform transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "oklch(0.12 0.01 260)" }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-3 p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarInner onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-border"
          style={{ background: "oklch(0.12 0.01 260)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))" }}
            >
              <Plane style={{ width: 14, height: 14, color: "oklch(0.10 0.01 260)" }} />
            </div>
            <span className="text-sm font-semibold text-foreground">Ministry of Travel</span>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
