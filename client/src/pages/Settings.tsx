import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Plus, Pencil, Trash2,
  Settings as SettingsIcon, Wifi, WifiOff, Save, X,
} from "lucide-react";
import { LocalLoginForm } from "@/components/LocalLoginForm";

interface DestinationFormData {
  name: string;
  iataCode: string;
  region: string;
  bookingWindowDays: number;
  defaultTripDays: number;
  isActive: boolean;
}

const EMPTY_FORM: DestinationFormData = {
  name: "",
  iataCode: "",
  region: "",
  bookingWindowDays: 120,
  defaultTripDays: 10,
  isActive: true,
};

const REGIONS = ["SE Asia", "NE Asia", "Europe", "N America", "Pacific", "Middle East", "Mexico", "Other"];

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<DestinationFormData>(EMPTY_FORM);

  const { data: destinations, refetch: refetchDestinations } = trpc.destinations.list.useQuery();
  const { data: connections, isLoading: connLoading, refetch: refetchConnections } = trpc.settings.checkConnections.useQuery(
    undefined,
    { enabled: isAdmin, refetchOnWindowFocus: false }
  );

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

      {/* API Connection Status */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">API Connection Status</h2>
          <button
            onClick={() => refetchConnections()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Loader2 className={`w-3 h-3 ${connLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConnectionCard
            name="Amadeus Flight API"
            description={`Flight offers search · OAuth token · ${connections?.amadeusEnv === "production" ? "Production" : "Test"} environment`}
            configured={connections?.amadeusConfigured ?? false}
            connected={connections?.amadeus ?? false}
            loading={connLoading}
            envBadge={connections?.amadeusEnv}
          />
          <ConnectionCard
            name="OpenAI GPT-5-mini"
            description="AI deal rating · Travel tips"
            configured={connections?.openaiConfigured ?? false}
            connected={connections?.openai ?? false}
            loading={connLoading}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          API credentials are stored as environment secrets. To update them, contact your administrator or use the Secrets panel.
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
