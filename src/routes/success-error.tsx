import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { AppShell, StickyCta } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

type SuccessErrorSearch = {
  status?: string;
  phone?: string;
};

export const Route = createFileRoute("/success-error")({
  validateSearch: (search: Record<string, unknown>): SuccessErrorSearch => {
    return {
      status: typeof search.status === "string" ? search.status : undefined,
      phone: typeof search.phone === "string" ? search.phone : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Status - WhatsApp rewards" },
      { name: "description", content: "WhatsApp pairing status and reward details." },
      { property: "og:title", content: "Status - WhatsApp rewards" },
      { property: "og:description", content: "WhatsApp pairing status and reward details." },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const search = Route.useSearch();
  const isConnected = search?.status === "connected" || search?.status === "success";
  const phone = search?.phone;

  if (isConnected) {
    return (
      <AppShell
        title="Connected"
        footer={
          <StickyCta>
            <Button asChild variant="hero" size="xl" className="w-full">
              <Link to="/task">
                Go to Tasks <ArrowRight className="ml-1.5 size-5" />
              </Link>
            </Button>
          </StickyCta>
        }
      >
        <div className="flex flex-col items-center px-2 pt-12 text-center">
          <span className="grid size-24 place-items-center rounded-full bg-emerald-500/10">
            <span className="grid size-16 place-items-center rounded-full bg-emerald-600 text-white shadow-button">
              <CheckCircle className="size-9" />
            </span>
          </span>
          <h2 className="mt-6 text-2xl font-extrabold text-foreground">
            WhatsApp Connected!
          </h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {phone
              ? `Your WhatsApp number +91 ${phone} is successfully linked and active.`
              : "Your WhatsApp device has been linked and is now active."}
          </p>

          <div className="mt-6 w-full rounded-2xl border bg-card p-4 shadow-card text-left space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Online & Earning
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Earning Rate</span>
              <span className="font-extrabold text-foreground">₹2.00 / hour</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Daily Potential</span>
              <span className="font-extrabold text-foreground">₹48.00 / day</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span>Encrypted WhatsApp Multi-Device Session</span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Result"
      footer={
        <StickyCta>
          <Button asChild variant="hero" size="xl" className="w-full">
            <Link to="/pairing">Use a different number</Link>
          </Button>
        </StickyCta>
      }
    >
      <div className="flex flex-col items-center px-2 pt-16 text-center">
        <span className="grid size-24 place-items-center rounded-full bg-secondary">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-button">
            <AlertCircle className="size-9" />
          </span>
        </span>
        <h2 className="mt-6 text-2xl font-extrabold">Number not accepted</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          The system could not accept this WhatsApp number or the session expired. Please continue with a different WhatsApp
          number.
        </p>
      </div>
    </AppShell>
  );
}
