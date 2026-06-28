import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.endsWith("/api/test-sessions")) {
    return jsonResponse({
      session_id: "session-150",
      stage: 1,
      words: [
        { word: "alpha", rank: 100, stage: 1 },
        { word: "beta", rank: 900, stage: 1 },
      ],
    })
  }
  if (url.endsWith("/api/test-sessions/session-150/next")) {
    return jsonResponse({
      session_id: "session-150",
      stage: 2,
      words: [
        { word: "gamma", rank: 1500, stage: 2 },
        { word: "delta", rank: 2400, stage: 2 },
      ],
    })
  }
  if (url.endsWith("/api/test-sessions/session-150/estimate")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { responses?: Array<{ word: string; known: boolean }> }
    return jsonResponse({
      estimate: 4200,
      range_low: 3800,
      range_high: 4700,
      confidence: 0.72,
      method: "rank_midpoint_bootstrap_v1",
      sample_size: body.responses?.length ?? 0,
      ignored_words: [],
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
    expect(screen.queryByRole("link", { name: "概览" })).not.toBeInTheDocument()
    expect(navLink("词汇测试")).toHaveAttribute("href", "/test")
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

  it("runs a 150-word two-stage vocabulary test with two answer states", async () => {
    render(<App />)

    fireEvent.click(navLink("词汇测试"))
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument())
    expect(screen.queryByText("首页")).not.toBeInTheDocument()
    expect(screen.getAllByText("词汇测试").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("阶段 1").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("0/150").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("rank 100").closest("[data-slot='badge']")).toBeInstanceOf(HTMLElement)
    expect(screen.getByRole("button", { name: "认识" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "不认识" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "不确定" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "认识" }))
    await waitFor(() => expect(screen.getByText("beta")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "不认识" }))
    await waitFor(() => expect(screen.getByText("gamma")).toBeInTheDocument())

    const firstStageCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/test-sessions"))
    const firstStageBody = JSON.parse(String((firstStageCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(firstStageBody.stage1_size).toBe(40)

    const nextStageCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/test-sessions/session-150/next"))
    const nextStageBody = JSON.parse(String((nextStageCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(nextStageBody.stage2_size).toBe(110)
    expect(nextStageBody.excluded_words).toEqual(["alpha", "beta"])
    expect(nextStageBody.responses).toEqual([
      { word: "alpha", known: true },
      { word: "beta", known: false },
    ])

    fireEvent.click(screen.getByRole("button", { name: "认识" }))
    await waitFor(() => expect(screen.getByText("delta")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "不认识" }))
    await waitFor(() => expect(screen.getByText("4200")).toBeInTheDocument())

    const estimateCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/test-sessions/session-150/estimate"))
    const estimateBody = JSON.parse(String((estimateCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(estimateBody.responses).toEqual([
      { word: "alpha", known: true },
      { word: "beta", known: false },
      { word: "gamma", known: true },
      { word: "delta", known: false },
    ])
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/api/adaptive-test-sessions"))).toBe(false)

    fireEvent.click(navLink("学生记录"))
    await waitFor(() => expect(screen.getByText("S001")).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText("姓名或代号"), { target: { value: "S100" } })
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }))
    await waitFor(() => expect(screen.getByText("学生测试记录已保存")).toBeInTheDocument())

    const saveCall = await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.filter(([url, init]) =>
        String(url).endsWith("/api/student-results") && (init as RequestInit | undefined)?.method === "POST"
      )
      expect(calls.length).toBeGreaterThan(0)
      return calls.at(-1)
    })
    const saveBody = JSON.parse(String((saveCall?.[1] as RequestInit | undefined)?.body ?? "{}"))
    expect(saveBody.estimate).toBe(4200)
    expect(saveBody.responses).toHaveLength(4)
  })

  it("uploads a selected CSV file from the batch page", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("link", { name: "批处理" }))
    expect(screen.queryByText("估算结果")).not.toBeInTheDocument()
    expect(screen.queryByText("等待结果")).not.toBeInTheDocument()
    const file = new File(["word,status\nalpha,known\nomega,unknown\n"], "responses.csv", { type: "text/csv" })
    fireEvent.change(screen.getByLabelText("选择 CSV 文件"), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/responses\.csv/)).toBeInTheDocument())
    const uploadButton = screen.getByRole("button", { name: "上传批处理" })
    await waitFor(() => expect(uploadButton).not.toBeDisabled())
    fireEvent.click(uploadButton)

    await waitFor(() => expect(screen.getByText("批处理任务 #7 已保存")).toBeInTheDocument())
    expect(screen.getByText("估算结果")).toBeInTheDocument()
    expect(screen.getByText("4200")).toBeInTheDocument()
    expect(screen.queryByText("等待结果")).not.toBeInTheDocument()
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

function navLink(name: string) {
  const link = screen
    .getAllByRole("link", { name })
    .find((element) => element instanceof HTMLAnchorElement && element.getAttribute("href")?.startsWith("/"))

  expect(link).toBeInstanceOf(HTMLAnchorElement)
  return link as HTMLAnchorElement
}
