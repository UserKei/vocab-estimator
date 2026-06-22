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

