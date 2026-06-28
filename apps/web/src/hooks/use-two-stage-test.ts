import { useCallback, useState } from "react"
import {
  createTestSession,
  estimateTestSession,
  requestNextStage,
  type EstimateResponseInput,
  type EstimateResult,
  type TestSession,
  type TestWord,
} from "@/api"
import { useAppState } from "@/state"

export const STAGE1_WORD_COUNT = 40
export const STAGE2_WORD_COUNT = 110
export const TOTAL_TEST_WORDS = STAGE1_WORD_COUNT + STAGE2_WORD_COUNT

export function useTwoStageTest() {
  const { setLatestEstimate } = useAppState()
  const [session, setSession] = useState<TestSession | null>(null)
  const [responses, setResponses] = useState<EstimateResponseInput[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [seed, setSeed] = useState(2026)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const answeredCount = responses.length
  const currentWord = estimate ? null : session?.words[currentIndex] ?? null
  const progress = estimate ? 100 : roundProgress(answeredCount)
  const stage = estimate ? 2 : session?.stage ?? 1

  const startNewTest = useCallback(async () => {
    const nextSeed = Date.now() % 100000
    setSeed(nextSeed)
    setIsBusy(true)
    setMessage("")
    setEstimate(null)
    setLatestEstimate(null, [])
    setResponses([])
    setCurrentIndex(0)
    try {
      setSession(await createTestSession(nextSeed))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试题生成失败")
      setSession(null)
    } finally {
      setIsBusy(false)
    }
  }, [setLatestEstimate])

  const resetTest = useCallback(() => {
    setSession(null)
    setResponses([])
    setCurrentIndex(0)
    setEstimate(null)
    setMessage("")
    setIsBusy(false)
    setLatestEstimate(null, [])
  }, [setLatestEstimate])

  const answerCurrentWord = useCallback(async (known: boolean) => {
    if (!session || !currentWord) {
      setMessage("请先生成测试题")
      return
    }

    const previousSession = session
    const previousResponses = responses
    const previousIndex = currentIndex
    const nextResponses = [...responses, { word: currentWord.word, known }]
    setResponses(nextResponses)
    setMessage("")

    if (currentIndex + 1 < session.words.length) {
      setCurrentIndex(currentIndex + 1)
      return
    }

    setIsBusy(true)
    try {
      if (session.stage === 1) {
        const nextSession = await requestNextStage(
          session.session_id,
          nextResponses,
          seed,
          nextResponses.map((response) => response.word),
        )
        setSession(nextSession)
        setCurrentIndex(0)
        return
      }

      const nextEstimate = await estimateTestSession(session.session_id, nextResponses)
      setEstimate(nextEstimate)
      setLatestEstimate(nextEstimate, nextResponses)
      setSession(null)
      setCurrentIndex(0)
      setMessage("测试完成")
    } catch (error) {
      setSession(previousSession)
      setResponses(previousResponses)
      setCurrentIndex(previousIndex)
      setMessage(error instanceof Error ? error.message : "估算失败")
    } finally {
      setIsBusy(false)
    }
  }, [currentIndex, currentWord, responses, seed, session, setLatestEstimate])

  return {
    answerCurrentWord,
    answeredCount,
    currentWord,
    estimate,
    isBusy,
    message,
    progress,
    responses,
    resetTest,
    session,
    stage,
    startNewTest,
    totalWords: TOTAL_TEST_WORDS,
  }
}

function roundProgress(answeredCount: number) {
  return Math.round(Math.min(100, (answeredCount / TOTAL_TEST_WORDS) * 1000)) / 10
}

export function responseLabel(response: EstimateResponseInput) {
  return response.known ? "认识" : "不认识"
}

export function responseVariant(response: EstimateResponseInput): "default" | "destructive" {
  return response.known ? "default" : "destructive"
}
