"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CheckSquare,
  FolderPlus,
  HeartPulse,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  NotebookPen,
  StickyNote,
  Bookmark,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskPopup } from "@/components/productivity/task-popup";
import { AddProjectDialog } from "@/components/productivity/add-project-dialog";
import { TransactionForm } from "@/app/(app)/finance/transaction-form";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { useCategories } from "@/lib/hooks/use-categories";

import { cn } from "@/lib/utils";
import { toast } from "sonner";

type InlineAction = "task" | "project" | "income" | "expense";

type Tile = {
  key: string;
  label: string;
  Icon: LucideIcon;
  cls: string;
} & ({ action: InlineAction } | { href: string });

// Every add action in the app. Static class strings so Tailwind keeps them.
const TILES: Tile[] = [
  { key: "task", label: "Task", Icon: CheckSquare, cls: "bg-mod-tasks-tint text-mod-tasks", action: "task" },
  { key: "project", label: "Project", Icon: FolderPlus, cls: "bg-mod-tasks-tint text-mod-tasks", action: "project" },
  { key: "habit", label: "Habit", Icon: HeartPulse, cls: "bg-mod-wellness-tint text-mod-wellness", href: "/wellness?add=habit" },
  { key: "goal", label: "Goal", Icon: Target, cls: "bg-mod-goals-tint text-mod-goals", href: "/goals?add=goal" },
  { key: "income", label: "Income", Icon: TrendingUp, cls: "bg-mod-finance-tint text-mod-finance", action: "income" },
  { key: "expense", label: "Expense", Icon: TrendingDown, cls: "bg-mod-finance-tint text-mod-finance", action: "expense" },
  { key: "transfer", label: "Transfer", Icon: ArrowLeftRight, cls: "bg-mod-finance-tint text-mod-finance", href: "/finance?add=transfer" },
  { key: "journal", label: "Journal", Icon: NotebookPen, cls: "bg-mod-goals-tint text-mod-goals", href: "/goals?add=journal" },
  { key: "note", label: "Note", Icon: StickyNote, cls: "bg-mod-knowledge-tint text-mod-knowledge", href: "/knowledge?add=note" },
  { key: "bookmark", label: "Bookmark", Icon: Bookmark, cls: "bg-mod-knowledge-tint text-mod-knowledge", href: "/knowledge?add=link" },
  { key: "contact", label: "Contact", Icon: UserPlus, cls: "bg-mod-crm-tint text-mod-crm", href: "/crm?add=contact" },
];

export function QuickAddFab() {
  // Defer mounting the data-fetching panel until the user first opens the menu.
  const [primed, setPrimed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPrimed(true);
          setMenuOpen(true);
        }}
        aria-label="Quick add"
        className="tap-target fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-brand transition-all hover:bg-brand-hover active:scale-95 md:bottom-6"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      {primed && <QuickAddPanel menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}
    </>
  );
}

function QuickAddPanel({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const router = useRouter();
  const { createTask } = useTasks("today");
  const { projects, createProject } = useProjects();
  const { paymentMethods, findOrCreateByName } = usePaymentMethods();
  const { categories, createCategory } = useCategories();

  const [active, setActive] = useState<InlineAction | null>(null);

  function handleTile(tile: Tile) {
    setMenuOpen(false);
    if ("href" in tile) {
      router.push(tile.href);
      return;
    }
    setActive(tile.action);
  }

  async function handleCreateTask(data: Parameters<typeof createTask>[0]) {
    try {
      await createTask(data);
      toast.success("Task added");
    } catch {
      toast.error("Failed to create task");
    }
  }

  return (
    <>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {TILES.map((tile) => (
              <button
                key={tile.key}
                type="button"
                onClick={() => handleTile(tile)}
                className="tappable flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border p-2 text-center transition-colors hover:bg-accent/40"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    tile.cls,
                  )}
                  aria-hidden="true"
                >
                  <tile.Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium leading-tight">{tile.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {active === "task" && (
        <TaskPopup
          task={null}
          projects={projects}
          defaultProjectId={null}
          onClose={() => setActive(null)}
          onCreate={handleCreateTask}
        />
      )}

      <AddProjectDialog
        open={active === "project"}
        onOpenChange={(v) => !v && setActive(null)}
        onProjectCreate={createProject}
      />

      <TransactionForm
        open={active === "income"}
        onOpenChange={(v) => !v && setActive(null)}
        defaultType="income"
        initial={null}
        onSaved={() => {
          toast.success("Income added");
          setActive(null);
        }}
        paymentMethods={paymentMethods}
        findOrCreateByName={findOrCreateByName}
        categories={categories}
        createCategory={createCategory}
      />

      <TransactionForm
        open={active === "expense"}
        onOpenChange={(v) => !v && setActive(null)}
        defaultType="expense"
        initial={null}
        onSaved={() => {
          toast.success("Expense added");
          setActive(null);
        }}
        paymentMethods={paymentMethods}
        findOrCreateByName={findOrCreateByName}
        categories={categories}
        createCategory={createCategory}
      />
    </>
  );
}

export default QuickAddFab;
