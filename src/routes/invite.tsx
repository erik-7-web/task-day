import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Gift, Share2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import whatsappIcon from "@/assets/whatsapp-icon.png";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Task Day - Invite & Earn Rewards" },
      { name: "description", content: "Share your invite link and earn bonus rewards when friends join." },
      { property: "og:title", content: "Task Day - Invite & Earn Rewards" },
      { property: "og:description", content: "Share your invite link and earn bonus rewards when friends join." },
    ],
  }),
  component: InvitePage,
});

const CODE = "WATASK2026";

function InvitePage() {
  const [link, setLink] = useState(`/invite?ref=${CODE}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/invite?ref=${CODE}`);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me", text: "Join and earn rewards with WhatsApp tasks.", url: link });
      } catch {
        /* dismissed */
      }
    } else {
      copy();
    }
  };

  return (
    <AppShell title="Invite" back>
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary-deep">
            <Gift className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold leading-tight">Invite friends, earn more</h2>
            <p className="text-sm text-muted-foreground">Get rewarded for every friend who joins.</p>
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold">Your invite link</p>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="truncate rounded-xl border bg-secondary px-3 py-3 text-sm font-medium text-secondary-foreground">
            {link}
          </div>
          <Button variant="hero" size="pill" className="h-11" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon={Users} label="Friends joined" value="0" />
        <Stat icon={Wallet} label="Referral earnings" value="₹0" />
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
        <h3 className="text-sm font-bold">Share with friends</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="soft" size="xl" className="h-12 text-sm" onClick={share}>
            <img src={whatsappIcon} alt="" width={24} height={24} className="size-6 object-contain" />
            WhatsApp
          </Button>
          <Button variant="hero" size="xl" className="h-12 text-sm" onClick={share}>
            <Share2 /> More
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-card">
        <h3 className="text-sm font-bold">How referrals work</h3>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          {["Copy your invite link.", "Send it to friends.", "Earn a reward when they complete a task."].map(
            (t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {t}
              </li>
            ),
          )}
        </ol>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
