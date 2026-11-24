import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { Habit, Task } from "@/lib/types/database";
import type { AttentionItem } from "@/lib/finance/attention";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/dynamic", () => ({ default: () => () => null }));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const upsert = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => ({ upsert }) }),
}));
vi.mock("@/lib/supabase/current-user", () => ({
  currentUserId: async () => "user-1",
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (msg: string) => toastError(msg), success: vi.fn() },
}));

type TodayData = {
  tasks: { tasks: Task[]; loading: boolean } & Record<string, unknown>;
  projects: { projects: { id: string; name: string }[] };
};
let todayData: TodayData;
vi.mock("@/components/dashboard/today-data-provider", () => ({
  useTodayData: () => todayData,
}));

import { TasksDashboardSection } from "./tasks-dashboard-section";
import { TasksStatCard } from "./tasks-stat-card";
import { MoneyAttentionCard } from "./money-attention-card";
import { HabitDashboardSection } from "@/components/wellness/habit-dashboard-section";

// ─── Fixtures ────────────────────────────────────────────────────────────────

// 08:00 in Dubai on Tuesday 24/11/2026.
const NOW = new Date("2026-11-24T04:00:00Z");
const TODAY = "2026-11-24";

function task(
  id: string,
  title: string,
  due_date: string,
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    user_id: "user-1",
    title,
    description: null,
    status: "todo",
    priority: "P3",
    due_date,
    due_time: null,
    completed_at: null,
    is_focus: false,
    focus_date: null,
    is_starred: false,
    labels: [],
    subtasks: [],
    attachments: [],
    recurrence: null,
    reminder: null,
    estimated_time: null,
    project_id: null,
    area: "default",
    deleted_at: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    is_completed: false,
    ...extra,
  };
}

function withTasks(tasks: Task[], loading = false) {
  todayData = {
    tasks: {
      tasks,
      loading,
      createTask: vi.fn(),
      updateTask: vi.fn(),
      completeTask: vi.fn(),
      deleteTask: vi.fn(),
      duplicateTask: vi.fn(),
      refresh: vi.fn(),
    },
    projects: { projects: [] },
  };
}

function habit(id: string, name: string): Habit {
  return {
    id,
    user_id: "user-1",
    name,
    description: null,
    frequency: "daily",
    target_days: [0, 1, 2, 3, 4, 5, 6],
    color: "#BE123C",
    icon: "heart",
    reminder_time: null,
    active: true,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─── Today's Tasks ───────────────────────────────────────────────────────────

describe("TasksDashboardSection", () => {
  it("groups overdue tasks first, then the ones due today", () => {
    withTasks([
      task("t1", "Review contract", TODAY),
      task("t2", "Send invoice", "2026-11-22"),
      task("t3", "Renew ID", "2026-11-23"),
    ]);
    render(<TasksDashboardSection />);

    const overdue = screen.getByRole("region", { name: /Overdue · 2/ });
    const dueToday = screen.getByRole("region", { name: /Due today · 1/ });
    expect(overdue.textContent).toContain("Send invoice");
    expect(overdue.textContent).toContain("Renew ID");
    expect(dueToday.textContent).toContain("Review contract");
    expect(
      overdue.compareDocumentPosition(dueToday) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leaves focus tasks to the focus card", () => {
    withTasks([
      task("f1", "Focus task", TODAY, { is_focus: true, focus_date: TODAY }),
      task("t1", "Regular task", TODAY),
    ]);
    render(<TasksDashboardSection />);
    expect(screen.queryByText("Focus task")).toBeNull();
    expect(screen.getByText("Regular task")).toBeDefined();
  });

  it("hides an empty group", () => {
    withTasks([task("t1", "Only today", TODAY)]);
    render(<TasksDashboardSection />);
    expect(screen.queryByText(/Overdue ·/)).toBeNull();
    expect(screen.getByText(/Due today · 1/)).toBeDefined();
  });

  it("caps the list at five across both groups and links to the rest", () => {
    withTasks([
      ...Array.from({ length: 4 }, (_, i) =>
        task(`o${i}`, `Overdue ${i}`, "2026-11-20"),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        task(`d${i}`, `Today ${i}`, TODAY),
      ),
    ]);
    render(<TasksDashboardSection />);
    expect(screen.getAllByText(/^Overdue \d$/)).toHaveLength(4);
    expect(screen.getAllByText(/^Today \d$/)).toHaveLength(1);
    expect(screen.getByText("+2 more tasks").getAttribute("href")).toBe(
      "/productivity",
    );
  });

  it("says so when nothing is due", () => {
    withTasks([]);
    render(<TasksDashboardSection />);
    expect(screen.getByText("No tasks due today.")).toBeDefined();
  });
});

// ─── Tasks tile ──────────────────────────────────────────────────────────────

describe("TasksStatCard", () => {
  it("counts every task in the list and flags the overdue ones", () => {
    withTasks([
      task("f1", "Focus", TODAY, { is_focus: true, focus_date: TODAY }),
      task("t1", "Today", TODAY),
      task("o1", "Late", "2026-11-23"),
    ]);
    render(<TasksStatCard />);
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("1 overdue").className).toContain(
      "text-destructive",
    );
  });

  it("reads all clear when nothing is overdue", () => {
    withTasks([task("t1", "Today", TODAY)]);
    render(<TasksStatCard />);
    expect(screen.getByText("all clear").className).toContain(
      "text-muted-foreground",
    );
  });

  it("shows a placeholder while the list loads", () => {
    withTasks([], true);
    render(<TasksStatCard />);
    expect(screen.getByText("—")).toBeDefined();
    expect(screen.getByText("Loading")).toBeDefined();
  });
});

// ─── Needs attention ─────────────────────────────────────────────────────────

describe("MoneyAttentionCard", () => {
  const item = (
    n: number,
    level: AttentionItem["level"] = "danger",
  ): AttentionItem => ({
    key: `k${n}`,
    level,
    title: `Item ${n}`,
    detail: `Detail ${n}`,
    target: "debts",
  });

  it("renders nothing when nothing needs attention", () => {
    const { container } = render(<MoneyAttentionCard items={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows up to four items with their urgency in words", () => {
    render(
      <MoneyAttentionCard
        items={[item(1), item(2, "warning"), item(3), item(4), item(5)]}
      />,
    );
    expect(screen.getAllByText(/^Item \d$/)).toHaveLength(4);
    expect(screen.getAllByText("Urgent.")).toHaveLength(3);
    expect(screen.getAllByText("Soon.")).toHaveLength(1);
    expect(screen.getByText("+1 more in Finance").getAttribute("href")).toBe(
      "/finance",
    );
  });
});

// ─── Habits ──────────────────────────────────────────────────────────────────

describe("HabitDashboardSection", () => {
  const habits = [
    habit("h1", "Evening walk"),
    habit("h2", "Read 20 pages"),
    habit("h3", "Stretch"),
  ];
  const logs = [
    { habit_id: "h3", completed: true, logged_date: TODAY },
    { habit_id: "h1", completed: true, logged_date: "2026-11-23" },
    { habit_id: "h1", completed: true, logged_date: "2026-11-22" },
  ];

  it("counts today's completed habits in the header and lists the rest", () => {
    render(<HabitDashboardSection habits={habits} logs={logs} />);
    expect(screen.getByText("1/3 done")).toBeDefined();
    expect(screen.getByText("Evening walk")).toBeDefined();
    expect(screen.queryByText("Stretch")).toBeNull();
  });

  it("shows the streak from past logs", () => {
    render(<HabitDashboardSection habits={habits} logs={logs} />);
    expect(screen.getByText("2-day streak")).toBeDefined();
  });

  it("marks a habit done, updates the count and refreshes the page", async () => {
    upsert.mockResolvedValue({ error: null });
    render(<HabitDashboardSection habits={habits} logs={logs} />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Mark Evening walk done" }),
      );
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        habit_id: "h1",
        logged_date: TODAY,
        completed: true,
        deleted_at: null,
      }),
      { onConflict: "habit_id,logged_date" },
    );
    expect(screen.getByText("2/3 done")).toBeDefined();
    expect(screen.queryByText("Evening walk")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the habit and warns when saving fails", async () => {
    upsert.mockResolvedValue({ error: { message: "db down" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<HabitDashboardSection habits={habits} logs={logs} />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Mark Read 20 pages not done" }),
      );
    });

    expect(toastError).toHaveBeenCalledWith(
      "Could not update this habit. Please try again.",
    );
    expect(screen.getByText("Read 20 pages")).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says so when no habits are due or all are logged", () => {
    const { unmount } = render(<HabitDashboardSection habits={[]} logs={[]} />);
    expect(screen.getByText("No habits due today.")).toBeDefined();
    unmount();
    render(
      <HabitDashboardSection
        habits={[habit("h1", "Walk")]}
        logs={[{ habit_id: "h1", completed: false, logged_date: TODAY }]}
      />,
    );
    expect(screen.getByText("All habits logged for today.")).toBeDefined();
  });
});
