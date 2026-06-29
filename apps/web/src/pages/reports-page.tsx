import { useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { fetchReportOutputs, type ReportOutputs } from "@/api"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ReportRow = Record<string, string | number | null>

const reportSections = [
  {
    title: "四类语料文本估计",
    description: "C.txt、F.txt、P.txt、K.txt 的词汇量估计输出。",
    key: "text_estimates",
    columns: ["text_path", "estimate", "range_low", "range_high", "confidence", "matched_words", "ranked_words"],
    labels: {
      text_path: "语料文件",
      estimate: "估计词汇量",
      range_low: "范围下限",
      range_high: "范围上限",
      confidence: "文本覆盖置信度",
      matched_words: "识别词数",
      ranked_words: "可估计词数",
    },
  },
  {
    title: "四类学员画像估计",
    description: "四类不同水平学员的估计范围和置信度。",
    key: "learner_profiles",
    columns: ["learner_class", "estimate", "range_low", "range_high", "confidence"],
    labels: {
      learner_class: "学员类别",
      estimate: "估计词汇量",
      range_low: "范围下限",
      range_high: "范围上限",
      confidence: "估计置信度",
    },
  },
  {
    title: "稳定性实验摘要",
    description: "不同比例、不同长度、重复抽样后的均值和方差。",
    key: "stability_summary",
    columns: ["unknown_ratio", "sample_length", "estimate_mean", "estimate_stddev", "range_width_mean", "confidence_mean"],
    labels: {
      unknown_ratio: "未知比例",
      sample_length: "样本长度",
      estimate_mean: "估计均值",
      estimate_stddev: "估计标准差",
      range_width_mean: "平均范围宽度",
      confidence_mean: "平均置信度",
    },
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
      <PageHeader
        title="实验输出"
        description="查看四类语料估计、学员画像和稳定性实验摘要。这里只展示可由项目命令重新生成的真实输出。"
        badge="可复现报告材料"
      />
      {message ? (
        <Alert>
          <AlertTitle>状态</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div data-testid="report-sections" className="grid grid-cols-1 gap-5">
        {reportSections.map((section) => (
          <ReportTable
            key={section.key}
            title={section.title}
            description={section.description}
            rows={(reports?.[section.key] ?? []) as ReportRow[]}
            columns={section.columns}
            labels={section.labels}
          />
        ))}
      </div>
    </>
  )
}

function ReportTable({
  title,
  description,
  rows,
  columns,
  labels,
}: {
  title: string
  description: string
  rows: ReportRow[]
  columns: readonly string[]
  labels: Record<string, string>
}) {
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length ? `${description} 共 ${rows.length} 行。` : description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={makeColumns(columns, labels)} data={rows} pageSize={5} emptyText="暂无输出" />
      </CardContent>
    </Card>
  )
}

function makeColumns(keys: readonly string[], labels: Record<string, string>): ColumnDef<ReportRow>[] {
  return keys.map((key) => ({
    accessorKey: key,
    header: labels[key] ?? key,
    cell: ({ row }) => row.original[key] ?? "--",
  }))
}
