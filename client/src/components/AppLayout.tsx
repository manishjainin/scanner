import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Plane, LayoutDashboard, Settings, LogOut, User,
  Menu, X, KeyRound, ChevronUp, ChevronDown, Pencil, Eye, EyeOff,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LocalLoginForm } from "@/components/LocalLoginForm";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

// ─── Profile panel (inline in sidebar footer) ────────────────────────────────

function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"name" | "password">("name");
  const [name, setName] = useState(user?.name ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success(tab === "name" ? "Name updated" : "Password changed");
      utils.auth.me.invalidate();
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      if (tab === "name") onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveName = () => {
    if (!name.trim()) return;
    update.mutate({ name: name.trim(), currentPassword: currentPw });
  };

  const handleChangePassword = () => {
    if (newPw !== confirmPw) { toast.error("New passwords don't match"); return; }
    if (newPw.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    update.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  return (
    <div className="border-t border-border bg-secondary/20 px-3 py-3 space-y-3">
      {/* Tabs */}
      <div className="flex gap-1">
        {(["name", "password"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "name" ? "Display Name" : "Password"}
          </button>
        ))}
      </div>

      {tab === "name" && (
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-8 text-xs bg-secondary border-border"
          />
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Current password to confirm"
              className="h-8 text-xs bg-secondary border-border pr-8"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)" }}
            onClick={handleSaveName}
            disabled={update.isPending || !name.trim() || !currentPw}
          >
            Save Name
          </Button>
        </div>
      )}

      {tab === "password" && (
        <div className="space-y-2">
          {[
            { label: "Current password", value: currentPw, set: setCurrentPw, show: showCurrent, toggle: () => setShowCurrent((v) => !v) },
            { label: "New password (min 8)", value: newPw, set: setNewPw, show: showNew, toggle: () => setShowNew((v) => !v) },
            { label: "Confirm new password", value: confirmPw, set: setConfirmPw, show: showNew, toggle: () => setShowNew((v) => !v) },
          ].map(({ label, value, set, show, toggle }) => (
            <div key={label} className="relative">
              <Input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={label}
                className="h-8 text-xs bg-secondary border-border pr-8"
              />
              <button
                type="button"
                onClick={toggle}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          ))}
          <Button
            size="sm"
            className="w-full h-8 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)" }}
            onClick={handleChangePassword}
            disabled={update.isPending || !currentPw || !newPw || !confirmPw}
          >
            <KeyRound className="w-3 h-3 mr-1" />
            Change Password
          </Button>
        </div>
      )}

      <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
        <X className="w-3 h-3" /> Close
      </button>
    </div>
  );
}

// ─── Sidebar user footer ──────────────────────────────────────────────────────

function SidebarUserFooter() {
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [profileOpen, setProfileOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex-shrink-0 px-3 py-4 border-t border-border">
        <LocalLoginForm compact />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 border-t border-border">
      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}

      <div className="px-3 py-3 space-y-0.5">
        {/* User row */}
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/60 transition-colors group"
        >
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/80">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-medium text-foreground truncate">{user.name ?? user.email ?? "User"}</p>
            {isAdmin && <p className="text-xs" style={{ color: "oklch(0.78 0.15 75)" }}>Admin</p>}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            {profileOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </div>
        </button>

        {/* Sign out */}
        <button onClick={() => void logout()} className="sidebar-nav-item w-full text-left">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar nav content ──────────────────────────────────────────────────────

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Logo — fixed at top */}
      <div className="flex-shrink-0 px-5 py-5 border-b border-border">
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

      {/* Navigation — scrollable middle section */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
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

      {/* User section — always pinned at bottom */}
      <SidebarUserFooter />
    </>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — sticky viewport height so user section never scrolls away */}
      <aside
        className="hidden lg:flex w-60 flex-shrink-0 flex-col sticky top-0 h-screen border-r border-border overflow-hidden"
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

      {/* Mobile sidebar */}
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

      {/* Content */}
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
