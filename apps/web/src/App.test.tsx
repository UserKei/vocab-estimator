import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
      text_estimates: [{ text_path: "C.txt", estimate: "12000", range_low: "11000", range_high: "13000", confidence: "0.7" }],
      learner_profiles: [{ learner_class: "C", estimate: "11800", range_low: "10600", range_high: "12800", confidence: "0.6" }],
      stability_summary: [{ unknown_ratio: "0.1", sample_length: "200", estimate_mean: "9000", estimate_stddev: "450", range_width_mean: "1100" }],
      student_summary: [{ student_code: "S001", estimate_mean: "5000", runs: "3", cet4_score: "520", cet6_score: "480" }],
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
    if ((init?.method ?? "GET") === "POST") {
      return jsonResponse({
        id: 8,
        student_code: "S100",
        cet4_score: 520,
        cet6_score: 480,
        estimate: 4200,
        range_low: 3800,
        range_high: 4700,
        confidence: 0.72,
        method: "api_batch_job",
        created_at: "2026-06-22T00:00:00",
      })
    }
    return jsonResponse([
      {
        id: 1,
        student_code: "S001",
        cet4_score: 430,
        cet6_score: null,
        estimate: 3750,
        range_low: 3300,
        range_high: 4200,
        confidence: 0.62,
        method: "rank_midpoint_bootstrap_v1",
        created_at: "2026-06-22T00:00:00",
      },
    ])
  }
  return jsonResponse({ status: "ok" })
}))

describe("App", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.history.pushState({}, "", "/")
  })

  it("renders a sidebar-driven multi-page workbench", () => {
    render(<App />)

    expect(screen.getByText("vocab-estimator")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "概览" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "词汇测试" })).toHaveAttribute("href", "/test")
    expect(screen.getByRole("link", { name: "批处理" })).toHaveAttribute("href", "/batch")
    expect(screen.getByRole("link", { name: "学生记录" })).toHaveAttribute("href", "/students")
    expect(screen.getByRole("link", { name: "实验输出" })).toHaveAttribute("href", "/reports")
    expect(screen.queryByRole("tab", { name: "词汇测试" })).not.toBeInTheDocument()
  })

  it("keeps the Tailwind v4 stylesheet entrypoint enabled", () => {
    const stylesheet = readFileSync("src/index.css", "utf8")

    expect(stylesheet).toContain('@import "tailwindcss";')
    expect(stylesheet).toContain("background-size: 32px 32px")
  })

  it("navigates to the vocabulary test page and answers adaptive words", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("link", { name: "词汇测试" }))
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    expect(screen.getByText("首页")).toBeInTheDocument()
    expect(screen.getAllByText("词汇测试").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("rank 100").closest("[data-slot='badge']")).toBeInstanceOf(HTMLElement)

    fireEvent.click(screen.getByRole("button", { name: "认识" }))
    await waitFor(() => expect(screen.getByText("omega")).toBeInTheDocument())
    const answerCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/adaptive-test-sessions/adaptive-test/answer"))
    const body = JSON.parse(String((answerCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(body.responses[0]).toMatchObject({ word: "alpha", status: "known" })
  })

  it("supports uncertain answers in the adaptive test flow", async () => {
    window.history.pushState({}, "", "/test")
    render(<App />)

    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "不确定" }))

    await waitFor(() => expect(screen.getByText("middle")).toBeInTheDocument())
    const answerCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/adaptive-test-sessions/adaptive-test/answer"))
    const body = JSON.parse(String((answerCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(body.responses[0]).toMatchObject({ word: "alpha", status: "uncertain" })
  })

  it("uploads a selected CSV file from the batch page", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("link", { name: "批处理" }))
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

  it("renders paginated student records and can save the current estimate", async () => {
    window.history.pushState({}, "", "/students")
    render(<App />)

    await waitFor(() => expect(screen.getByText("S001")).toBeInTheDocument())
    expect(screen.getByRole("navigation", { name: "pagination" })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("姓名或代号"), { target: { value: "S100" } })
    fireEvent.change(screen.getByPlaceholderText("四级成绩"), { target: { value: "520" } })
    fireEvent.change(screen.getByPlaceholderText("六级成绩"), { target: { value: "480" } })
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }))

    await waitFor(() => expect(screen.getByText("请先完成一次估算")).toBeInTheDocument())
  })

  it("shows report outputs with table previews and correlation values", async () => {
    window.history.pushState({}, "", "/reports")
    render(<App />)

    await waitFor(() => expect(screen.getByText("四类语料文本估计")).toBeInTheDocument())
    expect(screen.getByText("C.txt")).toBeInTheDocument()
    const correlationCard = screen.getByText("四六级相关性").closest("[data-slot='card']")
    expect(correlationCard).toBeInstanceOf(HTMLElement)
    expect(within(correlationCard as HTMLElement).getByText("0.99")).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
}
