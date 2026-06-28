import type { EstimateResult } from "@/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MetricCard } from "./metric-card"

export function ResultCard({
  estimate,
  answeredCount,
  totalWords,
  progress,
  statusLabel,
  pendingDescription = "完成测试后会生成估算结果。",
}: {
  estimate: EstimateResult | null
  answeredCount: number
  totalWords: number
  progress: number
  statusLabel: string
  pendingDescription?: string
}) {
  const progressLabel = totalWords ? `${Math.round(progress)}%` : "--"

  return (
    <Card>
      <CardHeader>
        <CardTitle>估算结果</CardTitle>
        <CardDescription>结果包含词汇量、范围和置信度。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {estimate ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-5xl font-semibold">{estimate.estimate}</span>
              <Badge variant="secondary">{estimate.method}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="范围下限" value={estimate.range_low.toString()} />
              <MetricCard label="范围上限" value={estimate.range_high.toString()} />
              <MetricCard label="置信度" value={estimate.confidence.toString()} />
              <MetricCard label="样本量" value={estimate.sample_size.toString()} />
            </div>
            {estimate.ignored_words.length ? (
              <Alert>
                <AlertTitle>忽略词</AlertTitle>
                <AlertDescription>{estimate.ignored_words.join(", ")}</AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">本次测试进度</p>
                <p className="text-sm text-muted-foreground">{pendingDescription}</p>
              </div>
              <Badge variant="outline">{statusLabel}</Badge>
            </div>
            <Progress value={progress} className="[&_[data-slot=progress-indicator]]:transition-none" />
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="已完成" value={`${answeredCount}/${totalWords || "--"}`} />
              <MetricCard label="当前进度" value={progressLabel} />
              <MetricCard label="估计范围" value="--" />
              <MetricCard label="置信度" value="--" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
