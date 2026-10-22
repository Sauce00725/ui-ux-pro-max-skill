/**
 * The environment every screen sits in: a slow aurora (the app's one ambient
 * loop, frozen under prefers-reduced-motion), a vignette and film grain.
 * Decorative only; fixed behind everything (see .ambient in components.css).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient">
      <div className="ambient-aurora" />
    </div>
  )
}
