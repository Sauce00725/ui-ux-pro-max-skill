/** Lets the stubbed server actions (plain async functions, no hooks) move the app. Wired up by RouterProvider. */
export const bus = {
  navigate: (_to: string, _opts?: { replace?: boolean }) => {},
  back: () => {},
  /** Soft: re-read the demo world, keeping what's on screen (what router.refresh() does in the real app). */
  refresh: () => {},
  /** Hard: throw the current screen away and rebuild it (used by the demo tools). */
  remount: () => {},
}
