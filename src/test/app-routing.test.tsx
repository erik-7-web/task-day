import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { TASKS } from "@/lib/tasks";

describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it.each(["/task", "/pairing", "/invite", "/success-error"])("matches %s", (path) => {
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
  });
});

describe("Tasks", () => {
  it("rewards 400 rupees per WhatsApp, up to 2800 for 7", () => {
    expect(TASKS).toHaveLength(7);
    expect(TASKS[0]?.reward).toBe(400);
    expect(TASKS[6]?.reward).toBe(2800);
  });
});
