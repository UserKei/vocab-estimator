export type EstimateResponseInput = {
  word: string
  known: boolean
}

export type EstimateResult = {
  estimate: number
  range_low: number
  range_high: number
  confidence: number
  method: string
  sample_size: number
  ignored_words: string[]
}

export type TestWord = {
  word: string
  rank: number
  stage: number
}

export type TestSession = {
  session_id: string
  stage: number
  words: TestWord[]
}

export type AdaptiveResponseStatus = "known" | "unknown" | "uncertain"

export type AdaptiveResponseInput = {
  word: string
  status: AdaptiveResponseStatus
}

export type AdaptiveSession = {
  session_id: string
  current_word: TestWord | null
  completed: boolean
  estimate: EstimateResult | null
  progress: number
  answered_count: number
  max_items: number
  target_rank: number
}

export type BatchJob = {
  id: number
  filename: string
  estimate: number
  range_low: number
  range_high: number
  confidence: number
  row_count: number
  ignored_count: number
  created_at: string
}

export type StudentResult = {
  id: number
  student_code: string
  cet4_score: number | null
  cet6_score: number | null
  estimate: number
  range_low: number
  range_high: number
  confidence: number
  method: string
  created_at: string
}

export type ReportOutputs = {
  text_estimates: Record<string, string>[]
  learner_profiles: Record<string, string>[]
  stability_summary: Record<string, string>[]
  student_summary: Record<string, string>[]
  student_correlation: Record<string, string | number | null>
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }
  return response.json() as Promise<T>
}

export function estimateVocabulary(responses: EstimateResponseInput[]) {
  return requestJson<EstimateResult>("/api/estimate", {
    method: "POST",
    body: JSON.stringify({ responses }),
  })
}

export function createTestSession(seed?: number) {
  return requestJson<TestSession>("/api/test-sessions", {
    method: "POST",
    body: JSON.stringify({ seed, stage1_size: 40 }),
  })
}

export function requestNextStage(sessionId: string, responses: EstimateResponseInput[], seed?: number) {
  return requestJson<TestSession>(`/api/test-sessions/${sessionId}/next`, {
    method: "POST",
    body: JSON.stringify({ responses, seed, stage2_size: 80 }),
  })
}

export function estimateTestSession(sessionId: string, responses: EstimateResponseInput[]) {
  return requestJson<EstimateResult>(`/api/test-sessions/${sessionId}/estimate`, {
    method: "POST",
    body: JSON.stringify({ responses }),
  })
}

export function createAdaptiveSession(seed?: number) {
  return requestJson<AdaptiveSession>("/api/adaptive-test-sessions", {
    method: "POST",
    body: JSON.stringify({ seed, max_items: 24, min_items: 10, start_rank: 5000 }),
  })
}

export function answerAdaptiveSession(
  sessionId: string,
  responses: AdaptiveResponseInput[],
  seed?: number,
) {
  return requestJson<AdaptiveSession>(`/api/adaptive-test-sessions/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ responses, seed, max_items: 24, min_items: 10, start_rank: 5000 }),
  })
}

export async function uploadBatchCsv(file: File) {
  const formData = new FormData()
  formData.append("file", file, file.name)
  const response = await fetch("/api/batch", {
    method: "POST",
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }
  return response.json() as Promise<BatchJob>
}

export function saveStudentResult(payload: {
  student_code: string
  cet4_score?: number | null
  cet6_score?: number | null
  estimate: number
  range_low: number
  range_high: number
  confidence: number
  method: string
  responses: EstimateResponseInput[]
}) {
  return requestJson<StudentResult>("/api/student-results", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function listStudentResults() {
  return requestJson<StudentResult[]>("/api/student-results")
}

export function fetchReportOutputs() {
  return requestJson<ReportOutputs>("/api/reports/outputs")
}
