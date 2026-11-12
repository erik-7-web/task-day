import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, Smartphone, Link2, KeyRound, RefreshCw, AlertCircle, PhoneCall, Clock, QrCode, Zap } from "lucide-react";
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
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingTab, setPairingTab] = useState<"code" | "qr">("code");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pairCodeRef = useRef<string | null>(null);
  const qrCodeRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const valid = phone.length === 10;

  const updatePairCode = (code: string | null) => {
    pairCodeRef.current = code;
    setPairCode(code);
  };

  const updateQrCode = (qr: string | null) => {
    qrCodeRef.current = qr;
    setQrCode(qr);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      stopTimer();
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Ensure body scroll is never locked when dialog closes or unmounts
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      document.documentElement.style.overflow = "";
    }
  }, [open]);

  // Countdown timer effect
  useEffect(() => {
    stopTimer();
    if ((pairCode || qrCode) && !isExpired) {
      const calculateTimeLeft = () => {
        if (!expiresAt) return 120;
        const diff = Math.floor((expiresAt - Date.now()) / 1000);
        return Math.max(0, diff);
      };

      setTimeLeft(calculateTimeLeft());

      timerIntervalRef.current = window.setInterval(() => {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
        if (remaining <= 0) {
          setIsExpired(true);
          stopTimer();
        }
      }, 1000);
    }
    return () => stopTimer();
  }, [pairCode, qrCode, expiresAt]);

  const handleStartPairing = async () => {
    if (!valid) return;
    setLoading(true);
    setErrorMessage(null);
    setErrorCode(null);
    setIsExpired(false);
    setOpen(true);
    updatePairCode(null);
    updateQrCode(null);
    setExpiresAt(null);

    const attr = captureAttribution();

    try {
      const data = await requestPairingCode(phone, "+91", phone, attr);
      if (data.ok) {
        if (data.pairCode) {
          updatePairCode(data.pairCode);
          setExpiresAt(data.expiresAt || Date.now() + 120000);
          toast.info("Pairing code generated! Link it in WhatsApp.");
        }
        if (data.qrCode) {
          updateQrCode(data.qrCode);
        }
        startPolling(phone, attr);
      } else {
        stopPolling();
        updatePairCode(null);
        updateQrCode(null);
        setErrorCode(data.code || "GATEWAY_ERROR");
        setErrorMessage(data.error || "Failed to generate pairing code from WhatsApp Gateway.");
        toast.error(
          data.code === "ACCOUNT_COOLDOWN_24H"
            ? "Account in 24-hour Cooldown"
            : data.error || "Pairing failed"
        );
      }
    } catch (err: any) {
      console.error("Pairing request failed:", err);
      stopPolling();
      updatePairCode(null);
      updateQrCode(null);
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
          stopTimer();
          // Trigger Meta Conversion ONLY after verified pairing
          if (res.conversion) {
            await trackMetaConversion(res.conversion);
          }
          toast.success("WhatsApp Linked Successfully!");
          navigate({ to: "/success-error", search: { status: "connected", phone: phoneNumber } as any });
        } else if (res.expired) {
          setIsExpired(true);
          stopTimer();
        } else {
          if (res.pairCode && !pairCodeRef.current) {
            updatePairCode(res.pairCode);
            if (res.expiresAt) setExpiresAt(res.expiresAt);
            setIsExpired(false);
          }
          if (res.qrCode && !qrCodeRef.current) {
            updateQrCode(res.qrCode);
          }
        }
      } catch (err) {
        console.error("Polling check error:", err);
      }
    }, 3000);
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

  const handleWithdrawToUPI = async () => {
    // 1. Copy pair code to clipboard so user can immediately paste in WhatsApp
    if (pairCode) {
      try {
        await navigator.clipboard.writeText(pairCode);
        toast.success(`Pairing code ${pairCode} copied to clipboard!`);
      } catch {
        toast.info(`Pairing code: ${pairCode}`);
      }
    }

    // 2. Open WhatsApp on device (redirect to WhatsApp Linked Devices)
    try {
      window.location.href = "whatsapp://";
    } catch (e) {
      console.log("Could not open whatsapp URI:", e);
    }

    // 3. Trigger live verification and continuous polling
    setVerifying(true);
    setErrorMessage(null);
    const attr = captureAttribution();
    try {
      const res = await confirmWhatsAppPairing(phone, "+91", phone, false, attr);
      if (res.connected || res.loggedIn) {
        stopPolling();
        stopTimer();
        // Trigger Meta Conversion ONLY after verified pairing
        if (res.conversion) {
          await trackMetaConversion(res.conversion);
        }
        toast.success("WhatsApp Connected! Processing UPI withdrawal…");
        navigate({ to: "/success-error", search: { status: "connected", phone } as any });
      } else {
        // Polling will detect the moment user confirms in WhatsApp
        startPolling(phone, attr);
        toast.info("Opening WhatsApp… Link device with the copied code!");
      }
    } catch {
      startPolling(phone, attr);
    } finally {
      setVerifying(false);
    }
  };

  const handleRefresh = async () => {
    stopPolling();
    stopTimer();
    updatePairCode(null);
    updateQrCode(null);
    setIsExpired(false);
    await handleStartPairing();
  };

  const handleResetNumber = () => {
    stopPolling();
    stopTimer();
    setOpen(false);
    updatePairCode(null);
    updateQrCode(null);
    setExpiresAt(null);
    setIsExpired(false);
    setErrorMessage(null);
    setErrorCode(null);
    setPhone("");
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
            stopTimer();
            setErrorMessage(null);
            setErrorCode(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto overscroll-contain rounded-3xl sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-extrabold">
              {errorMessage && !pairCode && !qrCode
                ? "Pairing Notice"
                : isExpired
                ? "Session Expired"
                : pairCode || qrCode
                ? pairingTab === "code"
                  ? "Your Pairing Code"
                  : "Scan WhatsApp QR"
                : "Connecting to WhatsApp…"}
            </DialogTitle>
            <DialogDescription>
              {errorMessage && !pairCode && !qrCode
                ? `Account notice for +91 ${phone}`
                : isExpired
                ? "This session has expired. Tap below to get a fresh code."
                : pairCode || qrCode
                ? `For WhatsApp +91 ${phone}`
                : "Connecting to WhatsApp Gateway…"}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && !pairCode && !qrCode ? (
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
          ) : isExpired ? (
            /* Expired Code UI */
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center space-y-2">
                <Clock className="size-9 mx-auto text-destructive" />
                <h4 className="font-bold text-sm text-foreground">
                  Pairing Session Expired
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  WhatsApp pairing sessions expire in 2-3 minutes. If your phone showed <i>"Something went wrong"</i> or <i>"Couldn't link device"</i>, the session timed out. Generate a fresh code and enter it immediately.
                </p>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleRefresh}
              >
                <RefreshCw className="mr-2 size-4" /> Generate Fresh Code
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={handleResetNumber}
              >
                Change Phone Number
              </Button>
            </div>
          ) : loading && !pairCode && !qrCode ? (
            <div className="grid place-items-center py-8 text-center space-y-3">
              <Loader2 className="size-10 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Generating Pairing Session…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connecting to WhatsApp Gateway for +91 {phone}…
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab Selector: Code vs QR */}
              {qrCode && (
                <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                      pairingTab === "code"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setPairingTab("code")}
                  >
                    <KeyRound className="size-3.5" /> 8-Digit Code
                  </button>
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                      pairingTab === "qr"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setPairingTab("qr")}
                  >
                    <QrCode className="size-3.5" /> Scan QR Code
                  </button>
                </div>
              )}

              {pairingTab === "code" && pairCode ? (
                <>
                  {/* Code Box with Copy */}
                  <div className="relative flex flex-col items-center justify-center rounded-2xl bg-secondary py-4 text-center">
                    <span className="text-3xl font-extrabold tracking-[0.2em] text-primary-deep">
                      {pairCode}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-3 top-4 size-9 rounded-xl"
                      onClick={handleCopyCode}
                      title="Copy code"
                    >
                      {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                    </Button>

                    {/* Countdown Timer */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Clock className={`size-3.5 ${timeLeft <= 30 ? "text-destructive animate-pulse" : "text-primary"}`} />
                      <span className={timeLeft <= 30 ? "text-destructive font-bold" : "text-muted-foreground"}>
                        Expires in: {formatTimer(timeLeft)}
                      </span>
                    </div>
                  </div>

                  {/* Step Instructions */}
                  <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Steps to link on your phone:</p>
                    <p>1. Open <b>WhatsApp</b> &gt; Settings (or ⋮) &gt; <b>Linked Devices</b></p>
                    <p>2. Tap <b>"Link a Device"</b></p>
                    <p>3. Tap <b>"Link with phone number instead"</b> at the bottom</p>
                    <p>4. Type the 8-digit code shown above <b>immediately</b></p>
                  </div>
                </>
              ) : qrCode ? (
                <>
                  {/* QR Code Container */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border bg-white p-4 text-center shadow-inner">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                      alt="WhatsApp QR Code"
                      className="size-48 rounded-xl object-contain"
                    />
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock className={`size-3.5 ${timeLeft <= 30 ? "text-destructive animate-pulse" : "text-primary"}`} />
                      <span className={timeLeft <= 30 ? "text-destructive font-bold" : ""}>
                        Expires in: {formatTimer(timeLeft)}
                      </span>
                    </div>
                  </div>

                  {/* QR Step Instructions */}
                  <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Steps to scan:</p>
                    <p>1. Open <b>WhatsApp</b> on this phone</p>
                    <p>2. Tap Settings (or ⋮) &gt; <b>Linked Devices</b></p>
                    <p>3. Tap <b>"Link a Device"</b> and scan this QR code directly</p>
                  </div>
                </>
              ) : (
                <div className="grid place-items-center py-6 text-center space-y-2">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Assigning session from WhatsApp Gateway…</p>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                variant="hero"
                size="xl"
                className="w-full text-base font-extrabold shadow-lg"
                disabled={verifying}
                onClick={handleWithdrawToUPI}
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" /> Verifying Connection…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 size-5 fill-current" /> Withdraw - to UPI
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
