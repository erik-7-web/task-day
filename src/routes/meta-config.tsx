import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle,
  Copy,
  ExternalLink,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sliders,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/whatsapp";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-pair`;

export const Route = createFileRoute("/meta-config")({
  head: () => ({
    meta: [
      { title: "Meta Pixel & Conversion Tracking Configuration" },
      { name: "description", content: "Manage Meta Pixel ID, CAPI tokens, and promoter tracking links." },
    ],
  }),
  component: MetaConfigPage,
});

function MetaConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingPromoter, setAddingPromoter] = useState(false);

  // Configuration state
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [eventName, setEventName] = useState("CompleteRegistration");
  const [conversionValue, setConversionValue] = useState("100");
  const [currency, setCurrency] = useState("INR");
  const [isActive, setIsActive] = useState(true);

  // Promoters and conversions
  const [promoters, setPromoters] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);

  // New promoter form
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoName, setNewPromoName] = useState("");
  const [newPromoPixel, setNewPromoPixel] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "get_meta_config",
          landingPage: typeof window !== "undefined" ? window.location.origin : "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.globalConfig) {
          setPixelId(data.globalConfig.pixel_id || "");
          setAccessToken(data.globalConfig.access_token || "");
          setTestEventCode(data.globalConfig.test_event_code || "");
          setEventName(data.globalConfig.conversion_event_name || "CompleteRegistration");
          setConversionValue(String(data.globalConfig.conversion_value || "100"));
          setCurrency(data.globalConfig.currency || "INR");
          setIsActive(data.globalConfig.is_active !== false);
        }
        setPromoters(data.promoters || []);
        setConversions(data.recentConversions || []);
      }
    } catch (err) {
      console.error("Error loading Meta config:", err);
      toast.error("Failed to load Meta configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "save_meta_config",
          config: {
            pixel_id: pixelId,
            access_token: accessToken,
            test_event_code: testEventCode,
            conversion_event_name: eventName,
            conversion_value: Number(conversionValue) || 100,
            currency: currency,
            is_active: isActive,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Meta Pixel configuration saved to Supabase!");
      } else {
        toast.error(data.error || "Failed to save configuration");
      }
    } catch {
      toast.error("Network error saving configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPromoter = async () => {
    if (!newPromoCode || !newPromoName) {
      toast.error("Promoter code and name are required");
      return;
    }
    setAddingPromoter(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "add_promoter",
          promoterCode: newPromoCode,
          name: newPromoName,
          pixelId: newPromoPixel || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Promoter ${newPromoName} created!`);
        setNewPromoCode("");
        setNewPromoName("");
        setNewPromoPixel("");
        await loadData();
      } else {
        toast.error(data.error || "Failed to add promoter");
      }
    } catch {
      toast.error("Network error adding promoter");
    } finally {
      setAddingPromoter(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch {
      toast.info(text);
    }
  };

  return (
    <AppShell title="Meta Tracking & Pixel Setup" back>
      <div className="space-y-6 pb-12">
        {/* Header Banner */}
        <div className="rounded-2xl border bg-gradient-to-r from-blue-950/20 to-indigo-950/20 p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
              <Sliders className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold leading-tight">Meta Pixel & CAPI Settings</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Configured centrally in Supabase. Update your Pixel ID and Conversion settings without touching any code.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="rounded-2xl border bg-card p-4 shadow-card space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Shield className="size-4 text-blue-500" />
            Meta Credentials & Conversion Event
          </h3>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Meta Pixel ID</label>
            <Input
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value.trim())}
              placeholder="e.g. 123456789012345"
              className="mt-1 h-10 text-sm font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              All website visitors will be initialized with this Pixel ID dynamically.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Conversions API (CAPI) Access Token (Server-Side)
            </label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value.trim())}
              placeholder="e.g. EAAG... (from Meta Events Manager)"
              className="mt-1 h-10 text-sm font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Optional. When set, verified WhatsApp conversions are sent via Meta Conversions API (server-side) to bypass ad blockers.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Test Event Code</label>
              <Input
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value.trim())}
                placeholder="e.g. TEST12345"
                className="mt-1 h-10 text-sm font-mono"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Found in Meta Events Manager &gt; Test Events tab.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Event Name</label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value.trim())}
                placeholder="CompleteRegistration"
                className="mt-1 h-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Conversion Value</label>
              <Input
                type="number"
                value={conversionValue}
                onChange={(e) => setConversionValue(e.target.value)}
                placeholder="100"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Currency</label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="INR"
                className="mt-1 h-10 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded accent-blue-600"
            />
            <label htmlFor="isActive" className="text-xs font-medium cursor-pointer">
              Enable Meta Pixel tracking globally
            </label>
          </div>

          <Button
            variant="hero"
            size="xl"
            className="w-full mt-2"
            disabled={saving || loading}
            onClick={handleSaveConfig}
          >
            <Save className="mr-2 size-4" />
            {saving ? "Saving to Supabase…" : "Save Configuration"}
          </Button>
        </div>

        {/* Promoter Tracking Links */}
        <div className="rounded-2xl border bg-card p-4 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="size-4 text-emerald-500" />
              Promoters & Ad Tracking Links
            </h3>
            <Button variant="ghost" size="sm" onClick={loadData} className="size-8 p-0">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Share these unique tracking links with your promoters or in Meta Ads. The system automatically tracks promoter ID, fbclid, and UTM parameters into Supabase.
          </p>

          {promoters.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              No promoters added yet. Add one below.
            </div>
          ) : (
            <div className="space-y-3">
              {promoters.map((p) => {
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const trackingLink = `${origin}/pairing?promoter=${encodeURIComponent(p.promoter_code)}&utm_source=meta&utm_medium=cpc&utm_campaign=${encodeURIComponent(p.name)}`;
                const convRate = p.total_visits > 0 ? ((p.total_conversions / p.total_visits) * 100).toFixed(1) : "0.0";

                return (
                  <div key={p.id} className="rounded-xl border bg-secondary/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">{p.name}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted font-semibold">
                        ID: {p.promoter_code}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 rounded-lg bg-background/60">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Visits</p>
                        <p className="font-extrabold">{p.total_visits || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Paired (Conv)</p>
                        <p className="font-extrabold text-emerald-600">{p.total_conversions || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Conv. Rate</p>
                        <p className="font-extrabold">{convRate}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={trackingLink}
                        className="flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground truncate select-all"
                      />
                      <Button
                        size="sm"
                        variant="soft"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => copyToClipboard(trackingLink, `${p.name} Tracking Link`)}
                      >
                        <Copy className="size-3.5 mr-1" /> Copy Link
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Promoter Form */}
          <div className="pt-2 border-t space-y-3">
            <h4 className="text-xs font-bold text-foreground">Add New Promoter / Campaign</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Promoter Code (e.g. ad_fb_1)"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"))}
                className="h-9 text-xs font-mono"
              />
              <Input
                placeholder="Campaign Name (e.g. Erik Ad 1)"
                value={newPromoName}
                onChange={(e) => setNewPromoName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <Input
              placeholder="Override Pixel ID (optional)"
              value={newPromoPixel}
              onChange={(e) => setNewPromoPixel(e.target.value.trim())}
              className="h-9 text-xs font-mono"
            />
            <Button
              size="sm"
              variant="hero"
              className="w-full h-9 text-xs"
              disabled={addingPromoter || !newPromoCode || !newPromoName}
              onClick={handleAddPromoter}
            >
              <Plus className="size-3.5 mr-1" />
              {addingPromoter ? "Adding…" : "Add Promoter & Generate Tracking Link"}
            </Button>
          </div>
        </div>

        {/* Live Conversion Events Log */}
        <div className="rounded-2xl border bg-card p-4 shadow-card space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Activity className="size-4 text-emerald-500" />
            Live Conversion Events (Verified Post-Pairing)
          </h3>
          <p className="text-xs text-muted-foreground">
            Conversions fire only after successful WhatsApp pairing confirmation. Events are deduplicated by unique Event ID.
          </p>

          {conversions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              No conversion events recorded yet. Connect a WhatsApp number to see verified conversions here.
            </div>
          ) : (
            <div className="space-y-2">
              {conversions.map((c) => (
                <div key={c.id} className="rounded-xl border bg-secondary/30 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle className="size-3.5 text-emerald-500" />
                      {c.event_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    Phone: {c.user_phone} | Promoter: {c.promoter_id || "none"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    Event ID: {c.event_id}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] pt-1">
                    <span className={c.browser_event_sent ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                      Browser: {c.browser_event_sent ? "Sent" : "Pending"}
                    </span>
                    <span className={c.server_capi_sent ? "text-blue-600 font-bold" : "text-muted-foreground"}>
                      CAPI: {c.server_capi_sent ? "Sent" : "Ready"}
                    </span>
                    <span className="ml-auto font-semibold text-emerald-600 uppercase">
                      {c.pairing_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="text-center pt-2">
          <Button asChild variant="soft" size="sm">
            <Link to="/pairing">
              Test WhatsApp Pairing Page <ExternalLink className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
