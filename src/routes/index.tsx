import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ search }: any) => {
    throw redirect({ to: "/task", search });
  },
});

