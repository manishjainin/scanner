import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  XCircle, Loader2, Plus, Pencil, Trash2,
  Settings as SettingsIcon, Wifi, WifiOff, Save, X, Bell, PlaneTakeoff,
  ShieldAlert, Eye, EyeOff, FlaskConical, Rocket, RefreshCw, CheckCircle2,
} from "lucide-react";
import { LocalLoginForm } from "@/components/LocalLoginForm";

interface DestinationFormData {
  name: string;
  iataCode: string;
  country: string;
  continent: string;
  region: string;
  bookingWindowDays: number;
  defaultTripDays: number;
  isActive: boolean;
}

const EMPTY_FORM: DestinationFormData = {
  name: "",
  iataCode: "",
  country: "",
  continent: "",
  region: "",
  bookingWindowDays: 120,
  defaultTripDays: 10,
  isActive: true,
};

const REGIONS = ["SE Asia", "NE Asia", "Europe", "N America", "Pacific", "Middle East", "Mexico", "South Asia", "Africa", "Other"];
const CONTINENTS = ["Asia", "Pacific", "Middle East", "Europe", "Americas", "Africa"];

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<DestinationFormData>(EMPTY_FORM);

  // Notification prefs local state
  const [notifThreshold, setNotifThreshold] = useState(-15);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [originsValue, setOriginsValue] = useState("SYD");

  const { data: destinations, refetch: refetchDestinations } = trpc.destinations.list.useQuery();
  const { data: connections, isLoading: connLoading, refetch: refetchConnections } = trpc.settings.checkConnections.useQuery(
    undefined,
    { enabled: isAdmin, refetchOnWindowFocus: false }
  );
  const { data: notifPrefs, refetch: refetchNotifPrefs } = trpc.settings.notificationPrefs.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  useEffect(() => {
    if (notifPrefs) {
      setNotifThreshold(notifPrefs.hotDealThreshold);
      setNotifEnabled(notifPrefs.enabled);
      setOriginsValue(notifPrefs.origins);
    }
  }, [notifPrefs]);

  const saveNotifPrefs = trpc.settings.saveNotificationPrefs.useMutation({
    onSuccess: () => { toast.success("Settings saved"); refetchNotifPrefs(); },
    onError: (e) => toast.error(e.message),
  });

  const createDest = trpc.destinations.create.useMutation({
    onSuccess: () => { toast.success("Destination added"); setShowAddForm(false); setFormData(EMPTY_FORM); refetchDestinations(); },
    onError: (e) => toast.error(e.message),
  });

  const updateDest = trpc.destinations.update.useMutation({
    onSuccess: () => { toast.success("Destination updated"); setEditingId(null); refetchDestinations(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteDest = trpc.destinations.delete.useMutation({
    onSuccess: () => { toast.success("Destination removed"); refetchDestinations(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = trpc.destinations.update.useMutation({
    onSuccess: () => refetchDestinations(),
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Sign in required</h2>
        <p className="text-muted-foreground text-sm mb-6">You need to be signed in as admin to access settings.</p>
        <div className="w-full max-w-sm">
          <LocalLoginForm />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Admin access required</h2>
        <p className="text-muted-foreground text-sm">This page is only accessible to administrators.</p>
      </div>
    );
  }

  const startEdit = (dest: NonNullable<typeof destinations>[0]) => {
    setEditingId(dest.id);
    setFormData({
      name: dest.name,
      iataCode: dest.iataCode,
      country: dest.country ?? "",
      continent: dest.continent ?? "",
      region: dest.region,
      bookingWindowDays: dest.bookingWindowDays,
      defaultTripDays: dest.defaultTripDays,
      isActive: dest.isActive,
    });
  };

  const handleSave = () => {
    if (editingId !== null) {
      updateDest.mutate({ id: editingId, ...formData });
    } else {
      createDest.mutate(formData);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage destinations, booking windows, and API connections</p>
        </div>
      </div>

      {/* Scan Origins & Notification Preferences */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Scan & Notification Settings</h2>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* Scan origins */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PlaneTakeoff className="w-3.5 h-3.5 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">Scan Origins</label>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Comma-separated IATA codes to scan from (e.g. <span className="font-mono">SYD,MEL,BNE</span>)
            </p>
            <Input
              value={originsValue}
              onChange={(e) => setOriginsValue(e.target.value.toUpperCase())}
              placeholder="SYD"
              className="bg-secondary border-border text-foreground text-sm max-w-xs font-mono"
            />
          </div>

          {/* Notification threshold */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Hot Deal Alert Threshold
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Send push notification when price is this far below the 30-day average. Current: <span className="text-foreground font-semibold">{notifThreshold}%</span>
            </p>
            <div className="flex items-center gap-4 max-w-sm">
              <span className="text-xs text-muted-foreground w-10">−50%</span>
              <input
                type="range"
                min={-50}
                max={-1}
                step={1}
                value={notifThreshold}
                onChange={(e) => setNotifThreshold(parseInt(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="text-xs text-muted-foreground w-8">−1%</span>
            </div>
          </div>

          {/* Notifications enabled toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notifEnabled"
              checked={notifEnabled}
              onChange={(e) => setNotifEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="notifEnabled" className="text-sm text-foreground">
              Enable push notifications for hot deals
            </label>
          </div>

          <Button
            onClick={() => saveNotifPrefs.mutate({
              hotDealThreshold: notifThreshold,
              enabled: notifEnabled,
              origins: originsValue || "SYD",
            })}
            disabled={saveNotifPrefs.isPending}
            size="sm"
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)" }}
          >
            {saveNotifPrefs.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Settings
          </Button>
        </div>
      </section>

      {/* Amadeus API Configuration */}
      <AmadeusSection />

      {/* OpenAI connection status */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Other Connections</h2>
          <button onClick={() => refetchConnections()} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <Loader2 className={`w-3 h-3 ${connLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <ConnectionCard
          name="OpenAI GPT-4o-mini"
          description="AI deal rating · Travel tips · AI chat"
          configured={connections?.openaiConfigured ?? false}
          connected={connections?.openai ?? false}
          loading={connLoading}
        />
        <p className="text-xs text-muted-foreground mt-3">
          OpenAI key is set via environment variable (<span className="font-mono">OPENAI_API_KEY</span>).
        </p>
      </section>

      {/* Destinations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Destinations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {destinations?.filter((d) => d.isActive).length ?? 0} active · {destinations?.length ?? 0} total
            </p>
          </div>
          <Button
            onClick={() => { setShowAddForm(true); setEditingId(null); setFormData(EMPTY_FORM); }}
            size="sm"
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Destination
          </Button>
        </div>

        {/* Add/Edit form */}
        {(showAddForm || editingId !== null) && (
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {editingId !== null ? "Edit Destination" : "Add New Destination"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <FormField label="City Name">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Bali"
                  className="bg-secondary border-border text-foreground text-sm"
                />
              </FormField>
              <FormField label="IATA Code">
                <Input
                  value={formData.iataCode}
                  onChange={(e) => setFormData((p) => ({ ...p, iataCode: e.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="e.g. DPS"
                  maxLength={3}
                  className="bg-secondary border-border text-foreground text-sm uppercase"
                />
              </FormField>
              <FormField label="Country">
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                  placeholder="e.g. Indonesia"
                  className="bg-secondary border-border text-foreground text-sm"
                />
              </FormField>
              <FormField label="Continent">
                <select
                  value={formData.continent}
                  onChange={(e) => setFormData((p) => ({ ...p, continent: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-secondary text-foreground text-sm px-3"
                >
                  <option value="">Select continent</option>
                  {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Region">
                <select
                  value={formData.region}
                  onChange={(e) => setFormData((p) => ({ ...p, region: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-secondary text-foreground text-sm px-3"
                >
                  <option value="">Select region</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
              <FormField label="Booking Window (days)" hint="Days ahead to search">
                <Input
                  type="number"
                  value={formData.bookingWindowDays}
                  onChange={(e) => setFormData((p) => ({ ...p, bookingWindowDays: parseInt(e.target.value) || 90 }))}
                  min={7}
                  max={365}
                  className="bg-secondary border-border text-foreground text-sm"
                />
              </FormField>
              <FormField label="Default Trip (days)" hint="Round-trip duration">
                <Input
                  type="number"
                  value={formData.defaultTripDays}
                  onChange={(e) => setFormData((p) => ({ ...p, defaultTripDays: parseInt(e.target.value) || 7 }))}
                  min={1}
                  max={60}
                  className="bg-secondary border-border text-foreground text-sm"
                />
              </FormField>
              <FormField label="Status">
                <div className="flex items-center gap-2 h-9">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isActive" className="text-sm text-foreground">Active</label>
                </div>
              </FormField>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={createDest.isPending || updateDest.isPending || !formData.name || !formData.iataCode || !formData.region}
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)", fontWeight: 600 }}
              >
                {(createDest.isPending || updateDest.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAddForm(false); setEditingId(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Destinations table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Destination</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Region</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Booking Window</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Trip Days</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {destinations?.map((dest, i) => (
                <tr
                  key={dest.id}
                  className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/30"}`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{dest.name}</p>
                      <p className="text-xs text-muted-foreground">{dest.iataCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{dest.region}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{dest.bookingWindowDays} days</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{dest.defaultTripDays} days</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate({ id: dest.id, isActive: !dest.isActive })}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        dest.isActive
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {dest.isActive ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(dest)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${dest.name}?`)) deleteDest.mutate({ id: dest.id });
                        }}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Amadeus API configuration panel ─────────────────────────────────────────

function CredentialForm({ env, label, icon: Icon, onSaved }: {
  env: "test" | "production";
  label: string;
  icon: React.ElementType;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = trpc.amadeus.saveCredentials.useMutation({
    onSuccess: () => { toast.success(`${label} credentials saved`); setOpen(false); setClientId(""); setClientSecret(""); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const testConn = trpc.amadeus.testConnection.useMutation({
    onSuccess: (r) => setTestResult(r),
    onError: (e) => setTestResult({ ok: false, message: e.message }),
  });

  return (
    <div>
      <button
        onClick={() => { setOpen((v) => !v); setTestResult(null); }}
        className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium"
      >
        {open ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
        {open ? "Cancel" : "Update credentials"}
      </button>
      {open && (
        <div className="mt-3 space-y-3 p-4 bg-secondary/30 rounded-lg border border-border">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Client ID</label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. aBcDeF1234567890"
              className="bg-secondary border-border text-foreground text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Client Secret</label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="••••••••••••••••"
                className="bg-secondary border-border text-foreground text-sm font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {testResult && (
            <p className={`text-xs flex items-center gap-1.5 ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
              {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {testResult.message}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => save.mutate({ env, clientId: clientId.trim(), clientSecret: clientSecret.trim() })}
              disabled={save.isPending || !clientId.trim() || !clientSecret.trim()}
              className="text-xs h-8"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)", fontWeight: 600 }}
            >
              {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testConn.mutate({ env })}
              disabled={testConn.isPending || !clientId.trim() || !clientSecret.trim()}
              className="text-xs h-8"
            >
              {testConn.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Test
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Credentials are stored encrypted in the database and never exposed in responses.
          </p>
        </div>
      )}
    </div>
  );
}

function AmadeusSection() {
  const { data: config, refetch } = trpc.amadeus.config.useQuery(undefined, { refetchOnWindowFocus: false });

  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeInput, setChallengeInput] = useState("");
  const [newChallenge, setNewChallenge] = useState("");
  const [showSetChallenge, setShowSetChallenge] = useState(false);
  const [showCurrentChallenge, setShowCurrentChallenge] = useState(false);

  const switchEnv = trpc.amadeus.switchEnv.useMutation({
    onSuccess: () => {
      toast.success("Amadeus environment switched");
      setChallengeInput("");
      setShowChallengeModal(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const setChallenge = trpc.amadeus.setChallenge.useMutation({
    onSuccess: () => {
      toast.success("Challenge passphrase updated");
      setNewChallenge("");
      setShowSetChallenge(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const isProd = config?.activeEnv === "production";

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Amadeus API</h2>
        <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${
          isProd ? "bg-orange-500/15 text-orange-400" : "bg-blue-500/15 text-blue-400"
        }`}>
          {isProd ? "⚡ Production" : "🧪 Test"} active
        </span>
      </div>

      <div className="space-y-4">
        {/* Test credentials */}
        <div className={`bg-card border rounded-xl p-5 ${!isProd ? "border-blue-500/30" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-foreground">Test Environment</span>
              {config?.test.fromEnv && (
                <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">from env</span>
              )}
            </div>
            {config?.test.configured
              ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Configured</span>
              : <span className="text-xs text-muted-foreground">Not configured</span>}
          </div>
          {config?.test.clientId && (
            <p className="text-xs text-muted-foreground mb-3 font-mono">
              ID: {config.test.clientId} &nbsp;·&nbsp; Secret: {config.test.clientSecretMasked}
            </p>
          )}
          <CredentialForm env="test" label="Test" icon={FlaskConical} onSaved={refetch} />
          {!isProd && (
            <p className="text-xs text-blue-400 mt-2">Currently active</p>
          )}
          {isProd && config?.test.configured && (
            <button
              onClick={() => switchEnv.mutate({ env: "test" })}
              disabled={switchEnv.isPending}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              {switchEnv.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Switch to Test
            </button>
          )}
        </div>

        {/* Production credentials */}
        <div className={`bg-card border rounded-xl p-5 ${isProd ? "border-orange-500/30" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-foreground">Production Environment</span>
            </div>
            {config?.production.configured
              ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Configured</span>
              : <span className="text-xs text-muted-foreground">Not configured</span>}
          </div>
          {config?.production.clientId && (
            <p className="text-xs text-muted-foreground mb-3 font-mono">
              ID: {config.production.clientId} &nbsp;·&nbsp; Secret: {config.production.clientSecretMasked}
            </p>
          )}
          <CredentialForm env="production" label="Production" icon={Rocket} onSaved={refetch} />
          {isProd && (
            <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />Currently active — live fares will be charged
            </p>
          )}
          {!isProd && config?.production.configured && (
            <button
              onClick={() => setShowChallengeModal(true)}
              className="mt-2 text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 font-medium"
            >
              <ShieldAlert className="w-3 h-3" />
              Activate Production
            </button>
          )}
          {!isProd && !config?.production.configured && (
            <p className="text-xs text-muted-foreground mt-2">Save production credentials above before activating.</p>
          )}
        </div>

        {/* Challenge passphrase management */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Production Challenge Passphrase</span>
            {config?.challengeSet
              ? <span className="text-xs text-emerald-400 ml-auto flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Set</span>
              : <span className="text-xs text-orange-400 ml-auto">Not set — no challenge required</span>}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            A passphrase that must be entered each time you switch to the production API. Protects against accidental activation.
          </p>
          <button
            onClick={() => setShowSetChallenge((v) => !v)}
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            {showSetChallenge ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
            {config?.challengeSet ? (showSetChallenge ? "Cancel" : "Change passphrase") : "Set passphrase"}
          </button>
          {showSetChallenge && (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showCurrentChallenge ? "text" : "password"}
                  value={newChallenge}
                  onChange={(e) => setNewChallenge(e.target.value)}
                  placeholder="Min 8 characters"
                  className="bg-secondary border-border text-foreground text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentChallenge((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentChallenge ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={() => setChallenge.mutate({ challenge: newChallenge })}
                disabled={setChallenge.isPending || newChallenge.length < 8}
                className="text-xs h-9 shrink-0"
                style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)", fontWeight: 600 }}
              >
                {setChallenge.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Challenge modal */}
      {showChallengeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-orange-500/30 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Activate Production API</h3>
                <p className="text-xs text-orange-400">Real fares · API usage charges apply</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your challenge passphrase to switch to the live Amadeus production environment.
            </p>
            <Input
              type="password"
              value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value)}
              placeholder="Challenge passphrase"
              className="bg-secondary border-border text-foreground mb-4"
              onKeyDown={(e) => {
                if (e.key === "Enter" && challengeInput) {
                  switchEnv.mutate({ env: "production", challenge: challengeInput });
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => { setShowChallengeModal(false); setChallengeInput(""); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 text-sm font-semibold"
                onClick={() => switchEnv.mutate({ env: "production", challenge: challengeInput })}
                disabled={switchEnv.isPending || !challengeInput}
                style={{ background: "linear-gradient(135deg, oklch(0.65 0.20 35), oklch(0.72 0.18 50))" }}
              >
                {switchEnv.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Activate
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ConnectionCard({ name, description, configured, connected, loading, envBadge }: {
  name: string; description: string; configured: boolean; connected: boolean; loading: boolean; envBadge?: string;
}) {
  const status = loading ? "checking" : !configured ? "not-configured" : connected ? "connected" : "error";

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        status === "connected" ? "bg-emerald-500/15" :
        status === "error" ? "bg-red-500/15" :
        status === "not-configured" ? "bg-secondary" :
        "bg-secondary"
      }`}>
        {status === "checking" ? (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        ) : status === "connected" ? (
          <Wifi className="w-4 h-4 text-emerald-400" />
        ) : status === "error" ? (
          <WifiOff className="w-4 h-4 text-red-400" />
        ) : (
          <XCircle className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{name}</p>
          {envBadge && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              envBadge === "production"
                ? "bg-orange-500/15 text-orange-400"
                : "bg-blue-500/15 text-blue-400"
            }`}>
              {envBadge === "production" ? "Production" : "Test"}
            </span>
          )}
          {!loading && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              status === "connected" ? "bg-emerald-500/15 text-emerald-400" :
              status === "error" ? "bg-red-500/15 text-red-400" :
              "bg-secondary text-muted-foreground"
            }`}>
              {status === "connected" ? "Connected" : status === "error" ? "Error" : status === "not-configured" ? "Not configured" : "Checking…"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {status === "not-configured" && (
          <p className="text-xs text-orange-400 mt-1">API credentials not found in environment</p>
        )}
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
        {label}
        {hint && <span className="text-xs text-muted-foreground/60 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
