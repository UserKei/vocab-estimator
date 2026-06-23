import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.endsWith("/api/adaptive-test-sessions")) {
    return jsonResponse({
      session_id: "adaptive-test",
      current_word: { word: "alpha", rank: 100, stage: 1 },
      completed: false,
      estimate: null,
      progress: 0,
      answered_count: 0,
      max_items: 24,
      target_rank: 100,
    })
  }
  if (url.endsWith("/api/adaptive-test-sessions/adaptive-test/answer")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { responses?: Array<{ status: string }> }
    const lastStatus = body.responses?.at(-1)?.status ?? "known"
    const nextWord = lastStatus === "unknown"
      ? { word: "easy", rank: 50, stage: 2 }
      : lastStatus === "uncertain"
        ? { word: "middle", rank: 600, stage: 2 }
        : { word: "omega", rank: 1200, stage: 2 }
    return jsonResponse({
      session_id: "adaptive-test",
      current_word: nextWord,
      completed: false,
      estimate: null,
      progress: 4.2,
      answered_count: 1,
      max_items: 24,
      target_rank: nextWord.rank,
    })
  }
  if (url.endsWith("/api/reports/outputs")) {
    return jsonResponse({
      text_estimates: [{ text_path: "C.txt", estimate: "12000", confidence: "0.7" }],
      learner_profiles: [{ learner_class: "C", estimate: "11800", confidence: "0.6" }],
      stability_summary: [{ unknown_ratio: "0.1", sample_length: "200", estimate_mean: "9000" }],
      student_summary: [{ student_code: "S001", estimate_mean: "5000", runs: "3" }],
      student_correlation: {
        cet4_estimate_correlation: 0.99,
        cet6_estimate_correlation: 0.98,
      },
    })
  }
  if (url.endsWith("/api/batch")) {
    return jsonResponse({
      id: 7,
      filename: "responses.csv",
      estimate: 4200,
      range_low: 3800,
      range_high: 4700,
      confidence: 0.72,
      row_count: 4,
      ignored_count: 0,
      created_at: "2026-06-22T00:00:00",
    })
  }
  if (url.endsWith("/api/student-results")) {
    return jsonResponse([])
  }
  return jsonResponse({ status: "ok" })
}))

describe("App", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders the vocabulary testing workbench", () => {
    render(<App />)

    expect(screen.getByText("vocab-estimator")).toBeInTheDocument()
    expect(screen.queryByText("课程设计工具台")).not.toBeInTheDocument()
    expect(screen.getByText("词汇测试")).toBeInTheDocument()
    expect(screen.getByText("批处理")).toBeInTheDocument()
    expect(screen.getByText("学生记录")).toBeInTheDocument()
    expect(screen.getByText("实验输出")).toBeInTheDocument()
  })

  it("keeps the Tailwind v4 stylesheet entrypoint enabled", () => {
    const stylesheet = readFileSync("src/index.css", "utf8")

    expect(stylesheet).toContain('@import "tailwindcss";')
    expect(stylesheet).toContain("background-size: 32px 32px")
  })

  it("loads one adaptive word from the API instead of a fixed frontend list", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    expect(screen.getByText("自适应词汇测试")).toBeInTheDocument()
    expect(screen.getByText("不确定")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith("/api/adaptive-test-sessions", expect.objectContaining({ method: "POST" }))
  })

  it("renders summary progress and the current rank badge", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    expect(screen.getByText("进度")).toBeInTheDocument()
    expect(screen.getByText("本次测试进度")).toBeInTheDocument()
    expect(screen.getByText("逐词动态调整")).toBeInTheDocument()
    expect(screen.getByText("rank 100").closest("[data-slot='badge']")).toBeInstanceOf(HTMLElement)
  })

  it("moves to the next adaptive word after marking the current word known", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "认识" }))

    await waitFor(() => expect(screen.getByText("omega")).toBeInTheDocument())
    const answerCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/adaptive-test-sessions/adaptive-test/answer"))
    const body = JSON.parse(String((answerCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(body.responses[0]).toMatchObject({ word: "alpha", status: "known" })
  })

  it("supports uncertain answers in the adaptive test flow", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "不确定" }))

    await waitFor(() => expect(screen.getByText("middle")).toBeInTheDocument())
    const answerCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/adaptive-test-sessions/adaptive-test/answer"))
    const body = JSON.parse(String((answerCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(body.responses[0]).toMatchObject({ word: "alpha", status: "uncertain" })
  })

  it("uses a high contrast action for marking a word unknown", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    const unknownButton = screen.getByRole("button", { name: "不认识" })

    expect(unknownButton).toHaveAttribute("data-variant", "destructive")
  })

  it("shows student score correlation outputs on the reports tab", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("tab", { name: "实验输出" }))
    await waitFor(() => expect(screen.getByText("四六级相关性")).toBeInTheDocument())
    expect(screen.getByText("cet4_estimate_correlation")).toBeInTheDocument()
    expect(screen.getByText("0.99")).toBeInTheDocument()
  })

  it("uploads a selected CSV file for batch processing", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("tab", { name: "批处理" }))
    const file = new File(["word,status\nalpha,known\nomega,unknown\n"], "responses.csv", { type: "text/csv" })
    fireEvent.change(screen.getByLabelText("选择 CSV 文件"), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/responses\.csv/)).toBeInTheDocument())
    const uploadButton = screen.getByRole("button", { name: "上传批处理" })
    await waitFor(() => expect(uploadButton).not.toBeDisabled())
    fireEvent.click(uploadButton)

    await waitFor(() => expect(screen.getByText("批处理任务 #7 已保存")).toBeInTheDocument())
    expect(fetch).toHaveBeenCalledWith("/api/batch", expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }))
  })

  it("accepts a dragged CSV file for batch processing", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("tab", { name: "批处理" }))
    const file = new File(["word,status\nalpha,known\nomega,unknown\n"], "dragged.csv", { type: "text/csv" })
    const dropZone = screen.getByLabelText("拖拽 CSV 文件到这里")
    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(screen.getByText(/dragged\.csv/)).toBeInTheDocument())
    const uploadButton = screen.getByRole("button", { name: "上传批处理" })
    await waitFor(() => expect(uploadButton).not.toBeDisabled())
    fireEvent.click(uploadButton)

    await waitFor(() => expect(screen.getByText("批处理任务 #7 已保存")).toBeInTheDocument())
    expect(fetch).toHaveBeenCalledWith("/api/batch", expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }))
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
}
