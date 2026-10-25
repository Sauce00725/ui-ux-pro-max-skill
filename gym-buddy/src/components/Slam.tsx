/**
 * Headline letters that land one after another (the animation is `.slam-ch`
 * in motion.css). The real text stays in the DOM for screen readers and
 * search; the split letters are decoration.
 *
 * `delay` is when the first letter lands, in ms; the rest follow on --step-letter.
 */
export function Slam({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  return (
    <span className={className} style={{ '--slam-delay': `${delay}ms` } as React.CSSProperties}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {Array.from(text).map((ch, i) => (
          <span key={i} className="slam-ch" style={{ '--i': i } as React.CSSProperties}>
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </span>
    </span>
  )
}
