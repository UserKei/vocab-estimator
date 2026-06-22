import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.endsWith("/api/test-sessions")) {
    return new Response(JSON.stringify({
      session_id: "session-test",
      stage: 1,
      words: [
        { word: "alpha", rank: 100, stage: 1 },
        { word: "bravo", rank: 900, stage: 1 },
      ],
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
  if (url.endsWith("/api/student-results")) {
    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } })
}))

describe("App", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the vocabulary testing workbench", () => {
    render(<App />)

    expect(screen.getByText("vocab-estimator")).toBeInTheDocument()
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

  it("shows student score correlation outputs on the reports tab", async () => {
    render(<App />)

    fireEvent.click(screen.getByRole("tab", { name: "实验输出" }))
    await waitFor(() => expect(screen.getByText("四六级相关性")).toBeInTheDocument())
    expect(screen.getByText("cet4_estimate_correlation")).toBeInTheDocument()
    expect(screen.getByText("0.99")).toBeInTheDocument()
  })
})
