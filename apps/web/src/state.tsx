import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { EstimateResponseInput, EstimateResult } from "./api"

type AppState = {
  latestEstimate: EstimateResult | null
  latestResponses: EstimateResponseInput[]
  setLatestEstimate: (estimate: EstimateResult | null, responses?: EstimateResponseInput[]) => void
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [latestEstimate, setEstimate] = useState<EstimateResult | null>(null)
  const [latestResponses, setLatestResponses] = useState<EstimateResponseInput[]>([])

  const setLatestEstimate = useCallback((estimate: EstimateResult | null, responses: EstimateResponseInput[] = []) => {
      setEstimate(estimate)
      setLatestResponses(responses)
  }, [])

  const value = useMemo<AppState>(() => ({
    latestEstimate,
    latestResponses,
    setLatestEstimate,
  }), [latestEstimate, latestResponses, setLatestEstimate])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider")
  }
  return context
}
