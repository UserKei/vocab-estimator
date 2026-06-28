import { useCallback, useEffect, useMemo, useState } from "react"
import {
  answerAdaptiveSession,
  createAdaptiveSession,
  type AdaptiveResponseInput,
  type AdaptiveResponseStatus,
  type AdaptiveSession,
  type EstimateResponseInput,
  type EstimateResult,
} from "@/api"
import { useAppState } from "@/state"

const ADAPTIVE_MAX_ITEMS = 24

export function toEstimateResponses(responses: AdaptiveResponseInput[]): EstimateResponseInput[] {
  return responses.flatMap((response) =>
    response.status === "uncertain"
      ? []
      : [{ word: response.word, known: response.status === "known" }],
  )
}

export function statusLabel(status: AdaptiveResponseStatus) {
  if (status === "known") {
    return "认识"
  }
  if (status === "unknown") {
    return "不认识"
  }
  return "不确定"
}

export function useAdaptiveTest() {
  const { setLatestEstimate } = useAppState()
  const [adaptiveSession, setAdaptiveSession] = useState<AdaptiveSession | null>(null)
  const [adaptiveResponses, setAdaptiveResponses] = useState<AdaptiveResponseInput[]>([])
  const [adaptiveSeed, setAdaptiveSeed] = useState(2026)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const currentWord = adaptiveSession?.current_word ?? null
  const answeredCount = adaptiveSession?.answered_count ?? adaptiveResponses.length
  const totalWords = adaptiveSession?.max_items ?? ADAPTIVE_MAX_ITEMS
  const progress = adaptiveSession?.progress ?? 0
  const responsePayload = useMemo(() => toEstimateResponses(adaptiveResponses), [adaptiveResponses])

  const startNewTest = useCallback(async () => {
    const seed = Date.now() % 100000
    setAdaptiveSeed(seed)
    setIsBusy(true)
    setMessage("")
    setEstimate(null)
    setLatestEstimate(null, [])
    setAdaptiveResponses([])
    try {
      setAdaptiveSession(await createAdaptiveSession(seed))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试题生成失败")
      setAdaptiveSession(null)
    } finally {
      setIsBusy(false)
    }
  }, [setLatestEstimate])

  useEffect(() => {
    void startNewTest()
  }, [startNewTest])

  const answerCurrentWord = useCallback(async (status: AdaptiveResponseStatus) => {
    if (!adaptiveSession || !currentWord) {
      setMessage("请先生成测试题")
      return
    }

    const previousResponses = adaptiveResponses
    const nextResponses = [...adaptiveResponses, { word: currentWord.word, status }]
    setAdaptiveResponses(nextResponses)
    setIsBusy(true)
    setMessage("")
    try {
      const next = await answerAdaptiveSession(adaptiveSession.session_id, nextResponses, adaptiveSeed)
      setAdaptiveSession(next)
      if (next.completed && next.estimate) {
        setEstimate(next.estimate)
        setLatestEstimate(next.estimate, toEstimateResponses(nextResponses))
        setMessage("测试完成")
      }
    } catch (error) {
      setAdaptiveResponses(previousResponses)
      setMessage(error instanceof Error ? error.message : "估算失败")
    } finally {
      setIsBusy(false)
    }
  }, [adaptiveResponses, adaptiveSeed, adaptiveSession, currentWord, setLatestEstimate])

  return {
    adaptiveSession,
    adaptiveResponses,
    answerCurrentWord,
    answeredCount,
    currentWord,
    estimate,
    isBusy,
    message,
    progress,
    responsePayload,
    startNewTest,
    totalWords,
  }
}
