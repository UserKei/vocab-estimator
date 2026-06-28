import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { listStudentResults, saveStudentResult, type StudentResult } from "@/api"
import { DataTable } from "@/components/data-table"
import { ResultCard } from "@/components/result-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAppState } from "@/state"

const studentColumns: ColumnDef<StudentResult>[] = [
  { accessorKey: "student_code", header: "代号" },
  {
    accessorKey: "cet4_score",
    header: "四级",
    cell: ({ row }) => row.original.cet4_score ?? "--",
  },
  {
    accessorKey: "cet6_score",
    header: "六级",
    cell: ({ row }) => row.original.cet6_score ?? "--",
  },
  { accessorKey: "estimate", header: "估计" },
  { accessorKey: "confidence", header: "置信度" },
  {
    accessorKey: "created_at",
    header: "测试时间",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
  },
]

export function StudentsPage() {
  const { latestEstimate, latestResponses } = useAppState()
  const [studentCode, setStudentCode] = useState("S001")
  const [cet4Score, setCet4Score] = useState("")
  const [cet6Score, setCet6Score] = useState("")
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    void refreshStudentResults()
  }, [])

  async function refreshStudentResults() {
    try {
      setStudentResults(await listStudentResults())
    } catch {
      setStudentResults([])
    }
  }

  async function saveCurrentResult() {
    if (!latestEstimate) {
      setMessage("请先完成一次估算")
      return
    }

    setIsBusy(true)
    setMessage("")
    try {
      await saveStudentResult({
        student_code: studentCode,
        cet4_score: cet4Score ? Number(cet4Score) : null,
        cet6_score: cet6Score ? Number(cet6Score) : null,
        estimate: latestEstimate.estimate,
        range_low: latestEstimate.range_low,
        range_high: latestEstimate.range_high,
        confidence: latestEstimate.confidence,
        method: latestEstimate.method,
        responses: latestResponses,
      })
      await refreshStudentResults()
      setMessage("学生测试记录已保存")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      {message ? (
        <Alert>
          <AlertTitle>状态</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>保存当前测试</CardTitle>
              <CardDescription>记录代号、四六级成绩和最近一次估算结果。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="student-code">姓名或代号</FieldLabel>
                  <Input
                    id="student-code"
                    value={studentCode}
                    onChange={(event) => setStudentCode(event.target.value)}
                    placeholder="姓名或代号"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cet4-score">四级成绩</FieldLabel>
                  <Input
                    id="cet4-score"
                    value={cet4Score}
                    onChange={(event) => setCet4Score(event.target.value)}
                    placeholder="四级成绩"
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cet6-score">六级成绩</FieldLabel>
                  <Input
                    id="cet6-score"
                    value={cet6Score}
                    onChange={(event) => setCet6Score(event.target.value)}
                    placeholder="六级成绩"
                    type="number"
                  />
                  <FieldDescription>保存前需要先完成一次测试或批处理估算。</FieldDescription>
                </Field>
              </FieldGroup>
              <Button onClick={saveCurrentResult} disabled={isBusy}>
                <Save data-icon="inline-start" />
                保存记录
              </Button>
            </CardContent>
          </Card>
          <ResultCard
            estimate={latestEstimate}
            answeredCount={latestResponses.length}
            totalWords={latestResponses.length}
            progress={latestEstimate ? 100 : 0}
            statusLabel={latestEstimate ? "可保存" : "等待估算"}
            pendingDescription="完成一次词汇测试或批处理估算后，可以在这里预览将保存的结果。"
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>测试记录</CardTitle>
            <CardDescription>用于后续分析四六级成绩和估算词汇量的关系。</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={studentColumns} data={studentResults} pageSize={5} emptyText="暂无学生测试记录" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
