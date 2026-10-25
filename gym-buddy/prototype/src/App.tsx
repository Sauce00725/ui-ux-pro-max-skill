import { useEffect } from 'react'
import { RouterProvider, useAppRouter } from './router'
import { Screen } from './screens'
import { DemoGuide } from './shell/DemoGuide'
import { AmbientBackground } from '@/components/AmbientBackground'

function Shell() {
  const { path } = useAppRouter()
  // The browser tab names the screen, as the real pages' metadata does.
  useEffect(() => {
    document.title = 'Gym Buddy'
  }, [path])
  return (
    <>
      <AmbientBackground />
      <Screen />
      <DemoGuide />
    </>
  )
}

export function App() {
  return (
    <RouterProvider>
      <Shell />
    </RouterProvider>
  )
}
