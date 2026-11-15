import { Link } from "@tanstack/react-router";
import { ChevronLeft, ListChecks, Sliders, UserPlus } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({
  title,
  back,
  children,
  footer,
}: {
  title: string;
  back?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 grid h-14 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center border-b bg-card/90 px-3 backdrop-blur">
        {back ? (
          <Link
            to="/task"
            aria-label="Back to tasks"
            className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          <span />
        )}
        <h1 className="truncate text-center text-base font-bold">{title}</h1>
        <Link
          to="/meta-config"
          aria-label="Meta Tracking Config"
          className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
        >
          <Sliders className="size-4" />
        </Link>
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">
        {children}
        <footer className="mt-8 border-t border-border/40 py-6 text-center space-y-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground/80">
            <strong>Independent Service Disclaimer:</strong> Task Day is an independent digital task and rewards community. This platform is NOT affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp LLC, Meta Platforms, Inc., or any of their subsidiaries or affiliates. WhatsApp is a registered trademark of WhatsApp LLC.
          </p>
          <div className="flex justify-center items-center gap-2 text-[10px] text-muted-foreground">
            <span>Terms of Service</span>
            <span>•</span>
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Security & Compliance</span>
          </div>
        </footer>
      </main>
      {footer ?? <BottomNav />}
    </div>
  );
}

function BottomNav() {
  const item =
    "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-semibold text-muted-foreground transition-colors";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t bg-card pb-[env(safe-area-inset-bottom)]">
      <Link to="/task" className={item} activeProps={{ className: "text-primary" }}>
        <ListChecks className="size-5" />
        Tasks
      </Link>
      <Link to="/invite" className={item} activeProps={{ className: "text-primary" }}>
        <UserPlus className="size-5" />
        Invite
      </Link>
      <Link to="/meta-config" className={item} activeProps={{ className: "text-primary" }}>
        <Sliders className="size-5" />
        Tracking
      </Link>
    </nav>
  );
}

export function StickyCta({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
      {children}
    </div>
  );
}
