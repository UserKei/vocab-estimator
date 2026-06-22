import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

const generatedTestWords = [
  { word: "alpha", rank: 100, stage: 1 },
  { word: "bravo", rank: 900, stage: 1 },
  ...Array.from({ length: 12 }, (_, index) => ({
    word: `word-${index + 3}`,
    rank: 1000 + index,
    stage: 1,
  })),
]

vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.endsWith("/api/test-sessions")) {
    return new Response(JSON.stringify({
      session_id: "session-test",
      stage: 1,
      words: generatedTestWords,
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  if (url.endsWith("/api/reports/outputs")) {
    return new Response(JSON.stringify({
      text_estimates: [{ text_path: "C.txt", estimate: "12000", confidence: "0.7" }],
      learner_profiles: [{ learner_class: "C", estimate: "11800", confidence: "0.6" }],
      stability_summary: [{ unknown_ratio: "0.1", sample_length: "200", estimate_mean: "9000" }],
      student_summary: [{ student_code: "S001", estimate_mean: "5000", runs: "3" }],
      student_correlation: {
        cet4_estimate_correlation: 0.99,
        cet6_estimate_correlation: 0.98,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  if (url.endsWith("/api/batch")) {
    return new Response(JSON.stringify({
      id: 7,
      filename: "responses.csv",
      estimate: 4200,
      range_low: 3800,
      range_high: 4700,
      confidence: 0.72,
      row_count: 4,
      ignored_count: 0,
      created_at: "2026-06-22T00:00:00",
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  if (url.endsWith("/api/student-results")) {
    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } })
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

  it("loads generated test words from the API instead of a fixed frontend list", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    expect(screen.getByText("bravo")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith("/api/test-sessions", expect.objectContaining({ method: "POST" }))
  })

  it("paginates generated test words to keep the testing card short", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument())
    expect(screen.getByText("alpha")).toBeInTheDocument()
    expect(screen.queryByText("word-9")).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("下一页"))

    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument()
    expect(screen.getByText("word-9")).toBeInTheDocument()
    expect(screen.queryByText("alpha")).not.toBeInTheDocument()
  })

  it("uses a high contrast selected state when marking a word unknown", async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    const wordRow = screen.getByText("alpha").parentElement?.parentElement
    expect(wordRow).toBeInstanceOf(HTMLElement)
    const unknownButton = within(wordRow as HTMLElement).getByRole("button", { name: "不认识" })

    fireEvent.click(unknownButton)

    expect(unknownButton).toHaveAttribute("data-variant", "destructive")
    expect(within(wordRow as HTMLElement).getByRole("button", { name: "认识" })).toHaveAttribute("data-variant", "outline")
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
