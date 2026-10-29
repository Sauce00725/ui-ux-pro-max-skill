import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * True once the component is running in the browser after hydration; false on
 * the server and during hydration, so both render the same markup. For output
 * that depends on the viewer (their timezone, their storage).
 */
export const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false)
