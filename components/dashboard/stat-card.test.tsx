import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { CheckSquare } from "lucide-react"

import { StatCard } from "./stat-card"

describe("StatCard", () => {
  afterEach(cleanup)

  it("renders label, value, and links to the module page", () => {
    render(
      <StatCard
        href="/productivity"
        label="Tasks"
        value="4"
        icon={CheckSquare}
        accent="tasks"
      />,
    )
    expect(screen.getByText("Tasks")).toBeDefined()
    expect(screen.getByText("4")).toBeDefined()
    expect(screen.getByRole("link").getAttribute("href")).toBe("/productivity")
  })

  it("renders a muted context line by default", () => {
    render(
      <StatCard
        href="/finance"
        label="Spent"
        value="AED 145"
        icon={CheckSquare}
        accent="finance"
        context="3 expenses"
      />,
    )
    const context = screen.getByText("3 expenses")
    expect(context.className).toContain("text-muted-foreground")
  })

  it("renders danger context tone for alerts", () => {
    render(
      <StatCard
        href="/productivity"
        label="Tasks"
        value="4"
        icon={CheckSquare}
        accent="tasks"
        context="2 overdue"
        contextTone="danger"
      />,
    )
    const context = screen.getByText("2 overdue")
    expect(context.className).toContain("text-destructive")
  })

  it("renders a progress bar instead of context when progress is given", () => {
    render(
      <StatCard
        href="/wellness"
        label="Habits"
        value="2/5"
        icon={CheckSquare}
        accent="wellness"
        progress={40}
        context="should not render"
      />,
    )
    expect(screen.getByRole("progressbar")).toBeDefined()
    expect(screen.queryByText("should not render")).toBeNull()
  })

  it("renders progress bar even at 0%", () => {
    render(
      <StatCard
        href="/wellness"
        label="Habits"
        value="0/5"
        icon={CheckSquare}
        accent="wellness"
        progress={0}
      />,
    )
    expect(screen.getByRole("progressbar")).toBeDefined()
  })
})
