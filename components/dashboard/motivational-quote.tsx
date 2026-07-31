"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"

const QUOTES: readonly string[] = [
  "🔥 Strength is built by facing discomfort.",
  "🌱 Growth happens when you choose challenges over comfort.",
  "🎯 Responsibility creates control over your life.",
  "💡 Better questions create better solutions.",
  "⭐ High standards create higher results.",
  "🌊 Calmness grows through controlled responses.",
  "🤝 Consistency builds trust and respect.",
  "🚶 Taking action before feeling ready builds confidence.",
  "🧠 Replacing \"I can't\" with \"How can I?\" creates solutions.",
  "💎 Accepting failure builds resilience.",
  "🎯 Focusing on solutions creates progress.",
  "🌟 Living with standards builds self-respect.",
  "🚀 Action destroys procrastination.",
  "⏳ Starting immediately builds momentum.",
  "🎯 Focused effort creates meaningful progress.",
  "📵 Removing distractions protects mental energy.",
  "🔥 Discipline creates results when motivation disappears.",
  "🔄 Consistency creates mastery over time.",
  "❌ Saying no protects your priorities.",
  "🏁 Finishing what you start builds confidence.",
  "📋 Prioritizing important tasks creates real progress.",
  "🌱 Small daily actions create powerful results.",
  "🏗️ Systems create results that goals cannot.",
  "🔁 Repeated actions create your future identity.",
  "🌱 Small improvements create lasting transformation.",
  "📅 Focusing on today reduces overwhelm.",
  "⚓ Daily anchors create stability during chaos.",
  "🧠 Routines reduce decision fatigue.",
  "⏰ Time blocking creates deeper focus.",
  "🔄 Replacing habits creates lasting change.",
  "✅ Small wins build self-trust.",
  "📊 Reviewing systems creates continuous improvement.",
  "🌳 Consistency during slow periods creates long-term success.",
  "🎯 Aligned habits create an aligned life.",
  "🏗️ Building systems creates predictable results.",
  "🔁 Fixing repetitions changes your future.",
  "🧩 Designing sustainable routines creates consistency.",
  "🧠 Automating decisions preserves mental energy.",
  "🌞 Controlling daily actions creates better outcomes.",
  "🔥 Improving one system regularly creates continuous growth.",
  "🔄 Changing your questions changes your possibilities.",
  "📖 Learning from failure creates growth.",
  "📝 Recording wins strengthens self-belief.",
  "👥 Choosing your environment shapes your mindset.",
  "📚 Learning from mentors accelerates progress.",
  "🎬 Visualization prepares your mind for success.",
  "🙏 Practicing gratitude builds emotional strength.",
  "📵 Unplugging creates clarity and deeper thinking.",
  "🤫 Silence improves self-awareness.",
  "❄️ Choosing discomfort builds mental toughness.",
  "⏸️ Pausing before reacting creates better decisions.",
  "🚀 Acting despite fear builds confidence.",
  "🎯 Protecting focus increases achievement.",
  "🌟 Building self-belief through action creates confidence.",
  "🧘 Practicing calm self-talk creates emotional control.",
  "🛡️ Training your mind through challenges builds resilience.",
  "🌍 Surrounding yourself with growth-minded people raises your standards.",
  "🎯 Visualizing goals with emotion strengthens commitment.",
  "🔕 Creating quiet time improves creativity and awareness.",
  "💪 Doing hard things intentionally builds mental strength.",
  "🌅 Completing important work first creates daily progress.",
  "❓ Questioning activities removes wasted effort.",
  "🌙 Reviewing your day creates continuous growth.",
  "📆 Weekly reflection improves your direction.",
  "🌍 Improving your environment makes success easier.",
  "🤫 Working without recognition builds inner confidence.",
  "🔥 Choosing consistency creates lasting results.",
  "💯 Taking ownership increases your power.",
  "🌟 Living by values creates alignment.",
  "🚀 Applying knowledge creates transformation.",
  "🎯 Completing your highest-impact task creates momentum.",
  "📈 Reviewing your progress creates better decisions.",
  "🗓️ Planning your day creates intentional execution.",
  "🔥 Taking responsibility creates personal growth.",
  "🏆 Practicing daily discipline creates long-term success.",
  "🌱 Improving 1% every day creates massive change.",
  "🚀 Taking small actions creates unstoppable momentum.",
  "🎯 Protecting your priorities creates freedom.",
]

function shuffleArray(arr: readonly string[]): string[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function MotivationalQuote() {
  const shuffled = useMemo(() => shuffleArray(QUOTES), [])
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const FADE_MS = 600
    let changeTimer: ReturnType<typeof setTimeout>

    const intervalTimer = setInterval(() => {
      setFading(true)
      changeTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % shuffled.length)
        setFading(false)
      }, FADE_MS)
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(intervalTimer)
      clearTimeout(changeTimer)
    }
  }, [shuffled.length])

  return (
    <div
      className="slide-up stagger-1 rounded-xl border border-border border-l-[3px] bg-card px-4 py-3 shadow-card"
      style={{ borderLeftColor: "var(--brand)" }}
      role="region"
      aria-label="Daily motivation"
      aria-live="polite"
    >
      <p
        className={cn(
          "text-sm font-medium leading-relaxed transition-opacity duration-500",
          fading ? "opacity-0" : "opacity-100",
        )}
      >
        {shuffled[index]}
      </p>
    </div>
  )
}
