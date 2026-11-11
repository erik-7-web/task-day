import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { TASKS, formatINR } from "@/lib/tasks";
import whatsappIcon from "@/assets/whatsapp-icon.png";

export const Route = createFileRoute("/task")({
  head: () => ({
    meta: [
      { title: "Tasks - WhatsApp rewards" },
      { name: "description", content: "Pick a WhatsApp task, claim your reward or invite friends." },
      { property: "og:title", content: "Tasks - WhatsApp rewards" },
      { property: "og:description", content: "Pick a WhatsApp task, claim your reward or invite friends." },
    ],
  }),
  component: TaskPage,
});

function TaskPage() {
  return (
    <AppShell title="Tasks">
      <p className="mb-4 px-1 text-sm text-muted-foreground">
        Complete today's WhatsApp tasks to earn rewards.
      </p>
      <ul className="space-y-3">
        {TASKS.map((t) => (
          <li
            key={t.id}
            className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-2xl border bg-card p-3 shadow-card"
          >
            <img
              src={whatsappIcon}
              alt="WhatsApp"
              width={56}
              height={56}
              loading="lazy"
              className="size-14 object-contain"
            />
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-extrabold leading-tight">
                {t.id} WhatsApp: {formatINR(t.reward)}
              </h2>
              <div className="mt-3 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={t.total}
                  aria-valuenow={t.done}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(t.done / t.total) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold leading-tight text-muted-foreground">
                  {t.done}/{t.total} Today
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild variant="hero" size="sm" className="h-9 rounded-xl">
                <Link to="/pairing">Claim</Link>
              </Button>
              <Button asChild variant="soft" size="sm" className="h-9 rounded-xl">
                <Link to="/invite">Invite</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
