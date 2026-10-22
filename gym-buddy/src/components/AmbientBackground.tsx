/**
 * The environment every screen sits in: speed lines, a volt light leak, and a
 * light streak that crosses now and then (the app's one ambient loop, off
 * under prefers-reduced-motion). Decorative only; fixed behind everything
 * (see .ambient in components.css).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient">
      <div className="ambient-streak" />
    </div>
  )
}
