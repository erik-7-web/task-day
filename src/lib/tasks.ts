export type Task = { id: number; reward: number; done: number; total: number };

export const TASKS: Task[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  id: n,
  reward: n * 400,
  done: 0,
  total: 1,
}));

export const formatINR = (v: number) => `₹${v.toLocaleString("en-IN")}`;
