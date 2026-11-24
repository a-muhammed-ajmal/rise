import { Quote } from "lucide-react"

import { todayISO } from "@/lib/format"

// One line of motivation under the Home greeting. It is the same all day and
// changes at Dubai midnight: the quote is picked from the Dubai calendar date,
// so the server render and the browser always agree and nothing re-renders on
// a timer. The small icon beside it replaces the emoji the lines used to carry.

const QUOTES: readonly string[] = [
  "Strength is built by facing discomfort.",
  "Growth happens when you choose challenges over comfort.",
  "Responsibility creates control over your life.",
  "Better questions create better solutions.",
  "High standards create higher results.",
  "Calmness grows through controlled responses.",
  "Consistency builds trust and respect.",
  "Taking action before feeling ready builds confidence.",
  "Replacing \"I can't\" with \"How can I?\" creates solutions.",
  "Accepting failure builds resilience.",
  "Focusing on solutions creates progress.",
  "Living with standards builds self-respect.",
  "Action destroys procrastination.",
  "Starting immediately builds momentum.",
  "Focused effort creates meaningful progress.",
  "Removing distractions protects mental energy.",
  "Discipline creates results when motivation disappears.",
  "Consistency creates mastery over time.",
  "Saying no protects your priorities.",
  "Finishing what you start builds confidence.",
  "Prioritizing important tasks creates real progress.",
  "Small daily actions create powerful results.",
  "Systems create results that goals cannot.",
  "Repeated actions create your future identity.",
  "Small improvements create lasting transformation.",
  "Focusing on today reduces overwhelm.",
  "Daily anchors create stability during chaos.",
  "Routines reduce decision fatigue.",
  "Time blocking creates deeper focus.",
  "Replacing habits creates lasting change.",
  "Small wins build self-trust.",
  "Reviewing systems creates continuous improvement.",
  "Consistency during slow periods creates long-term success.",
  "Aligned habits create an aligned life.",
  "Building systems creates predictable results.",
  "Fixing repetitions changes your future.",
  "Designing sustainable routines creates consistency.",
  "Automating decisions preserves mental energy.",
  "Controlling daily actions creates better outcomes.",
  "Improving one system regularly creates continuous growth.",
  "Changing your questions changes your possibilities.",
  "Learning from failure creates growth.",
  "Recording wins strengthens self-belief.",
  "Choosing your environment shapes your mindset.",
  "Learning from mentors accelerates progress.",
  "Visualization prepares your mind for success.",
  "Practicing gratitude builds emotional strength.",
  "Unplugging creates clarity and deeper thinking.",
  "Silence improves self-awareness.",
  "Choosing discomfort builds mental toughness.",
  "Pausing before reacting creates better decisions.",
  "Acting despite fear builds confidence.",
  "Protecting focus increases achievement.",
  "Building self-belief through action creates confidence.",
  "Practicing calm self-talk creates emotional control.",
  "Training your mind through challenges builds resilience.",
  "Surrounding yourself with growth-minded people raises your standards.",
  "Visualizing goals with emotion strengthens commitment.",
  "Creating quiet time improves creativity and awareness.",
  "Doing hard things intentionally builds mental strength.",
  "Completing important work first creates daily progress.",
  "Questioning activities removes wasted effort.",
  "Reviewing your day creates continuous growth.",
  "Weekly reflection improves your direction.",
  "Improving your environment makes success easier.",
  "Working without recognition builds inner confidence.",
  "Choosing consistency creates lasting results.",
  "Taking ownership increases your power.",
  "Living by values creates alignment.",
  "Applying knowledge creates transformation.",
  "Completing your highest-impact task creates momentum.",
  "Reviewing your progress creates better decisions.",
  "Planning your day creates intentional execution.",
  "Taking responsibility creates personal growth.",
  "Practicing daily discipline creates long-term success.",
  "Improving 1% every day creates massive change.",
  "Taking small actions creates unstoppable momentum.",
  "Protecting your priorities creates freedom.",
]

const DAY_MS = 86_400_000

/** The quote for a Dubai calendar day ("yyyy-MM-dd"); consecutive days step through the list. */
export function quoteForDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const day = Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
  const index = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[index]
}

export function MotivationalQuote({ date }: { date?: string }) {
  const quote = quoteForDay(date ?? todayISO())

  return (
    <section
      aria-label="Daily motivation"
      className="slide-up stagger-1 flex items-center gap-3 rounded-lg border-[1.5px] border-border bg-card px-3 py-2.5 shadow-card"
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-accent-tint text-brand-text"
        aria-hidden="true"
      >
        <Quote className="size-3.5" aria-hidden="true" />
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">{quote}</p>
    </section>
  )
}
