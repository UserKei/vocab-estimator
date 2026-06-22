import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { App } from "./App"

vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.endsWith("/api/student-results")) {
    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } })
}))

describe("App", () => {
  it("renders the vocabulary testing workbench", () => {
    render(<App />)

    expect(screen.getByText("vocab-estimator")).toBeInTheDocument()
    expect(screen.getByText("词汇测试")).toBeInTheDocument()
    expect(screen.getByText("批处理")).toBeInTheDocument()
    expect(screen.getByText("学生记录")).toBeInTheDocument()
  })
})

