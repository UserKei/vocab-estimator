import { useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { fetchReportOutputs, type ReportOutputs } from "@/api"
import { DataTable } from "@/components/data-table"
import { MetricCard } from "@/components/metric-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ReportRow = Record<string, string | number | null>

const reportSections = [
  {
    title: "四类语料文本估计",
    description: "C.txt、F.txt、P.txt、K.txt 的词汇量估计输出。",
    key: "text_estimates",
    columns: ["text_path", "estimate", "range_low", "range_high", "confidence"],
  },
  {
    title: "四类学员画像估计",
    description: "四类不同水平学员的估计范围和置信度。",
    key: "learner_profiles",
    columns: ["learner_class", "estimate", "range_low", "range_high", "confidence"],
  },
  {
    title: "稳定性实验摘要",
    description: "不同比例、不同长度、重复抽样后的均值和方差。",
    key: "stability_summary",
    columns: ["unknown_ratio", "sample_length", "estimate_mean", "estimate_stddev", "range_width_mean"],
  },
  {
    title: "学生测试样例摘要",
    description: "多次测试结果和四六级成绩的汇总。",
    key: "student_summary",
    columns: ["student_code", "runs", "cet4_score", "cet6_score", "estimate_mean"],
  },
] as const

export function ReportsPage() {
  const [reports, setReports] = useState<ReportOutputs | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    void refreshReports()
  }, [])

  async function refreshReports() {
    try {
      setReports(await fetchReportOutputs())
      setMessage("")
    } catch {
      setReports(null)
      setMessage("暂无报告输出，请先运行实验命令或部署 API。")
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
      <div className="grid gap-5 xl:grid-cols-2">
        {reportSections.map((section) => (
          <ReportTable
            key={section.key}
            title={section.title}
            description={section.description}
            rows={(reports?.[section.key] ?? []) as ReportRow[]}
            columns={section.columns}
          />
        ))}
        <CorrelationCard values={reports?.student_correlation ?? {}} />
      </div>
    </>
  )
}

function ReportTable({
  title,
  description,
  rows,
  columns,
}: {
  title: string
  description: string
  rows: ReportRow[]
  columns: readonly string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length ? `${description} 共 ${rows.length} 行。` : description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={makeColumns(columns)} data={rows} pageSize={5} emptyText="暂无输出" />
      </CardContent>
    </Card>
  )
}

function CorrelationCard({ values }: { values: Record<string, string | number | null> }) {
  const rows = Object.entries(values).filter(([key]) => key !== "note")

  return (
    <Card>
      <CardHeader>
        <CardTitle>四六级相关性</CardTitle>
        <CardDescription>{rows.length ? "学生测试样例数据的相关性输出。" : "暂无相关性输出。"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {rows.length ? (
          rows.map(([key, value]) => (
            <MetricCard key={key} label={key} value={value == null ? "--" : String(value)} />
          ))
        ) : (
          <MetricCard label="相关性" value="--" />
        )}
      </CardContent>
    </Card>
  )
}

function makeColumns(keys: readonly string[]): ColumnDef<ReportRow>[] {
  return keys.map((key) => ({
    accessorKey: key,
    header: key,
    cell: ({ row }) => row.original[key] ?? "--",
  }))
}
