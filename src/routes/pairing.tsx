import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, Smartphone, Link2, KeyRound, RefreshCw, AlertCircle, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StickyCta } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import {
  requestPairingCode,
  checkWhatsAppStatus,
  confirmWhatsAppPairing,
  disconnectWhatsApp,
} from "@/lib/whatsapp";
import { captureAttribution, trackMetaConversion } from "@/lib/meta-tracker";

export const Route = createFileRoute("/pairing")({
  head: () => ({
    meta: [
      { title: "Link WhatsApp - Enter your number" },
      { name: "description", content: "Enter your WhatsApp number and learn how device linking works." },
      { property: "og:title", content: "Link WhatsApp - Enter your number" },
      { property: "og:description", content: "Enter your WhatsApp number and learn how device linking works." },
    ],
  }),
  component: PairingPage,
});

const STEPS = [
  { icon: Smartphone, title: "Enter your number", text: "Type the WhatsApp number you want to use." },
  { icon: KeyRound, title: "Get a pairing code", text: "An 8-character code appears on your screen." },
  { icon: Link2, title: "Link in WhatsApp", text: "Open Settings > Linked devices > Link with phone number and type the code." },
];

function PairingPage() {
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const valid = phone.length === 10;

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleStartPairing = async () => {
    if (!valid) return;
    setLoading(true);
    setErrorMessage(null);
    setErrorCode(null);
    setOpen(true);
    setPairCode(null);

    const attr = captureAttribution();

    try {
      const data = await requestPairingCode(phone, "+91", phone, attr);
      if (data.ok) {
        if (data.pairCode) {
          setPairCode(data.pairCode);
          toast.info("Pairing code generated! Link it in WhatsApp.");
        }
        startPolling(phone, attr);
      } else {
        stopPolling();
        setPairCode(null);
        setErrorCode(data.code || "GATEWAY_ERROR");
        setErrorMessage(data.error || "Failed to generate pairing code from WhatsApp Gateway.");
        toast.error(
          data.code === "ACCOUNT_COOLDOWN_24H"
            ? "Account in 24-hour Cooldown"
            : (data.error || "Pairing failed")
        );
      }
    } catch (err: any) {
      console.error("Pairing request failed:", err);
      stopPolling();
      setPairCode(null);
      setErrorMessage("Network error connecting to WhatsApp gateway. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (phoneNumber: string, attr?: any) => {
    stopPolling();
    const activeAttr = attr || captureAttribution();
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await checkWhatsAppStatus(phoneNumber, "+91", phoneNumber, activeAttr);
        if (res.connected || res.loggedIn) {
          stopPolling();
          // Trigger Meta Conversion ONLY after verified pairing
          if (res.conversion) {
            await trackMetaConversion(res.conversion);
          }
          toast.success("WhatsApp Linked Successfully!");
          navigate({ to: "/success-error", search: { status: "connected", phone: phoneNumber } as any });
        } else if (res.pairCode && !pairCode) {
          setPairCode(res.pairCode);
        }
      } catch (err) {
        console.error("Polling check error:", err);
      }
    }, 4000);
  };

  const handleCopyCode = async () => {
    if (!pairCode) return;
    try {
      await navigator.clipboard.writeText(pairCode);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Code: ${pairCode}`);
    }
  };

  const handleConfirm = async () => {
    setVerifying(true);
    setErrorMessage(null);
    const attr = captureAttribution();
    try {
      const res = await confirmWhatsAppPairing(phone, "+91", phone, false, attr);
      if (res.connected || res.loggedIn) {
        stopPolling();
        // Trigger Meta Conversion ONLY after verified pairing
        if (res.conversion) {
          await trackMetaConversion(res.conversion);
        }
        toast.success("WhatsApp Connected Successfully!");
        navigate({ to: "/success-error", search: { status: "connected", phone } as any });
      } else {
        setErrorMessage(
          res.error ||
            "WhatsApp is not paired yet. Please open WhatsApp > Linked devices > Link with phone number instead, and enter the code."
        );
        toast.error("Device not connected yet");
      }
    } catch (err: any) {
      setErrorMessage("Could not verify device status. Please check your connection.");
    } finally {
      setVerifying(false);
    }
  };

  const handleRefresh = async () => {
    stopPolling();
    await handleStartPairing();
  };

  const handleResetNumber = () => {
    stopPolling();
    setOpen(false);
    setPairCode(null);
    setErrorMessage(null);
    setErrorCode(null);
    setPhone("");
  };

  return (
    <AppShell
      title="Link WhatsApp"
      back
      footer={
        <StickyCta>
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!valid || loading}
            onClick={handleStartPairing}
          >
            {loading ? <Loader2 className="animate-spin" /> : "Continue"}
          </Button>
        </StickyCta>
      }
    >
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <img src={whatsappIcon} alt="" width={48} height={48} className="size-12 object-contain" />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold leading-tight">WhatsApp number</h2>
            <p className="text-sm text-muted-foreground">We'll show a code to link your device.</p>
          </div>
        </div>
        <label htmlFor="phone" className="mt-5 block text-sm font-semibold">
          Phone number
        </label>
        <div className="mt-2 flex items-center gap-2">
          <span className="grid h-12 shrink-0 place-items-center rounded-xl border bg-secondary px-3 text-sm font-bold text-secondary-foreground">
            +91
          </span>
          <Input
            id="phone"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="h-12 rounded-xl text-base focus-visible:ring-2"
          />
        </div>
      </div>

      <h3 className="mb-3 mt-6 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        How linking works
      </h3>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-2xl border bg-card p-3 shadow-card">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary-deep">
              <s.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {i + 1}. {s.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            stopPolling();
            setErrorMessage(null);
            setErrorCode(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-extrabold">
              {errorMessage && !pairCode
                ? "Pairing Notice"
                : pairCode
                ? "Your pairing code"
                : "Requesting Pairing Code…"}
            </DialogTitle>
            <DialogDescription>
              {errorMessage && !pairCode
                ? `Account notice for +91 ${phone}`
                : pairCode
                ? `For +91 ${phone}`
                : "Connecting to WhatsApp Gateway…"}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && !pairCode ? (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-2">
                <AlertCircle className="size-9 mx-auto text-amber-500" />
                <h4 className="font-bold text-sm text-foreground">
                  {errorCode === "ACCOUNT_COOLDOWN_24H"
                    ? "24-Hour WhatsApp Cooldown"
                    : "Pairing Request Notice"}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {errorMessage}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={handleResetNumber}
                >
                  <PhoneCall className="mr-2 size-4" /> Use a Different Number
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={verifying}
                  onClick={async () => {
                    setVerifying(true);
                    try {
                      const res = await checkWhatsAppStatus(phone, "+91", phone);
                      if (res.connected || res.loggedIn) {
                        toast.success("WhatsApp is already connected!");
                        navigate({ to: "/success-error", search: { status: "connected", phone } as any });
                      } else {
                        toast.info("WhatsApp session is not active. Please link a new number.");
                      }
                    } catch {
                      toast.error("Could not check status.");
                    } finally {
                      setVerifying(false);
                    }
                  }}
                >
                  {verifying ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  Check If Already Connected
                </Button>
              </div>
            </div>
          ) : loading || !pairCode ? (
            <div className="grid place-items-center py-8 text-center space-y-3">
              <Loader2 className="size-10 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Requesting Pairing Code…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Waiting for WhatsApp Gateway to assign a pairing session for +91 {phone}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative flex items-center justify-center rounded-2xl bg-secondary py-5 text-center">
                <span className="text-3xl font-extrabold tracking-[0.2em] text-primary-deep">
                  {pairCode}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-xl"
                  onClick={handleCopyCode}
                  title="Copy code"
                >
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </Button>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Steps in WhatsApp:</p>
                <p>1. Open WhatsApp &gt; Settings &gt; Linked Devices</p>
                <p>2. Tap "Link a Device"</p>
                <p>3. Tap "Link with phone number instead"</p>
                <p>4. Enter the 8-digit code above</p>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                variant="hero"
                size="xl"
                className="w-full"
                disabled={verifying}
                onClick={handleConfirm}
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-5" /> I've entered the code
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground text-xs"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="mr-1.5 size-3.5" /> New Code
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground text-xs"
                  onClick={handleResetNumber}
                >
                  Change Number
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
