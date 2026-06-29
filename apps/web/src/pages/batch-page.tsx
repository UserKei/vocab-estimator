import { useState, type DragEvent } from "react"
import { FileUp, Upload } from "lucide-react"
import { uploadBatchCsv, type EstimateResult } from "@/api"
import { PageHeader } from "@/components/page-header"
import { ResultCard } from "@/components/result-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAppState } from "@/state"

export function BatchPage() {
  const { setLatestEstimate } = useAppState()
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [isBatchDragActive, setIsBatchDragActive] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState("")

  function selectBatchFile(fileList: ArrayLike<File> | null) {
    setBatchFile(fileList?.length ? fileList[0] : null)
  }

  function handleBatchDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setIsBatchDragActive(true)
  }

  function handleBatchDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsBatchDragActive(false)
  }

  function handleBatchDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsBatchDragActive(false)
    selectBatchFile(event.dataTransfer.files)
  }

  async function runBatchEstimate() {
    if (!batchFile) {
      setMessage("请先选择 CSV 文件")
      return
    }

    setIsBusy(true)
    setMessage("")
    try {
      const job = await uploadBatchCsv(batchFile)
      const nextEstimate = {
        estimate: job.estimate,
        range_low: job.range_low,
        range_high: job.range_high,
        confidence: job.confidence,
        method: "api_batch_job",
        sample_size: job.row_count,
        ignored_words: job.ignored_count ? [`ignored_count=${job.ignored_count}`] : [],
      }
      setEstimate(nextEstimate)
      setLatestEstimate(nextEstimate, [])
      setMessage(`批处理任务 #${job.id} 已保存`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批处理失败")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="CSV 批处理"
        description="上传 word,status 格式文件，复现原始需求中的后台批量估算流程；结果会保存为批处理任务记录。"
        badge="后台验证入口"
      />
      {message ? (
        <Alert>
          <AlertTitle>状态</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div
        data-testid="batch-workspace"
        className={cn(
          "mx-auto grid w-full gap-5",
          estimate ? "max-w-6xl lg:grid-cols-[1fr_0.85fr]" : "max-w-3xl",
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle>CSV 批处理估算</CardTitle>
            <CardDescription>上传文件复现实验里的后台批量估算。每行使用 word,status。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="batch-csv-file">选择 CSV 文件</FieldLabel>
                <label
                  htmlFor="batch-csv-file"
                  aria-label="拖拽 CSV 文件到这里"
                  onDragOver={handleBatchDragOver}
                  onDragLeave={handleBatchDragLeave}
                  onDrop={handleBatchDrop}
                  className={cn(
                    "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-background px-4 py-8 text-center transition-colors",
                    isBatchDragActive ? "border-primary bg-muted" : "border-border",
                  )}
                >
                  <FileUp className="text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">拖拽 CSV 文件到这里</span>
                  <span className="text-sm text-muted-foreground">或点击选择本地文件</span>
                  <Badge variant={batchFile ? "secondary" : "outline"}>
                    {batchFile ? `${batchFile.name} · ${batchFile.size} bytes` : "未选择文件"}
                  </Badge>
                </label>
                <Input
                  id="batch-csv-file"
                  className="sr-only"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => selectBatchFile(event.target.files)}
                />
                <FieldDescription>status 支持 known/unknown，也兼容 认识/不认识。</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={runBatchEstimate} disabled={isBusy || !batchFile}>
              <Upload data-icon="inline-start" />
              上传批处理
            </Button>
          </CardFooter>
        </Card>
        {estimate ? (
          <ResultCard
            estimate={estimate}
            answeredCount={0}
            totalWords={0}
            progress={0}
            statusLabel="已完成"
          />
        ) : null}
      </div>
    </>
  )
}
