import { useEffect, useMemo, useState, type DragEvent } from "react"
import { CheckCircle2, CircleHelp, Database, FileUp, RotateCcw, Save, Upload, XCircle } from "lucide-react"
import {
  answerAdaptiveSession,
  createAdaptiveSession,
  fetchReportOutputs,
  listStudentResults,
  saveStudentResult,
  uploadBatchCsv,
  type AdaptiveResponseInput,
  type AdaptiveResponseStatus,
  type AdaptiveSession,
  type EstimateResult,
  type ReportOutputs,
  type StudentResult,
} from "./api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const ADAPTIVE_MAX_ITEMS = 24

export function App() {
  const [adaptiveSession, setAdaptiveSession] = useState<AdaptiveSession | null>(null)
  const [adaptiveResponses, setAdaptiveResponses] = useState<AdaptiveResponseInput[]>([])
  const [adaptiveSeed, setAdaptiveSeed] = useState(2026)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [isBatchDragActive, setIsBatchDragActive] = useState(false)
  const [studentCode, setStudentCode] = useState("S001")
  const [cet4Score, setCet4Score] = useState("")
  const [cet6Score, setCet6Score] = useState("")
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [reports, setReports] = useState<ReportOutputs | null>(null)
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)
  const [activeTab, setActiveTab] = useState("test")

  const currentWord = adaptiveSession?.current_word ?? null
  const answeredCount = adaptiveSession?.answered_count ?? adaptiveResponses.length
  const totalWords = adaptiveSession?.max_items ?? ADAPTIVE_MAX_ITEMS
  const progress = adaptiveSession?.progress ?? 0
  const progressLabel = totalWords ? `${Math.round(progress)}%` : "--"
  const responsePayload = useMemo(
    () =>
      adaptiveResponses.flatMap((response) =>
        response.status === "uncertain"
          ? []
          : [{ word: response.word, known: response.status === "known" }],
      ),
    [adaptiveResponses],
  )

  useEffect(() => {
    void startNewTest()
    void refreshStudentResults()
    void refreshReports()
  }, [])

  async function refreshStudentResults() {
    try {
      setStudentResults(await listStudentResults())
    } catch {
      setStudentResults([])
    }
  }

  async function refreshReports() {
    try {
      setReports(await fetchReportOutputs())
    } catch {
      setReports(null)
    }
  }

  async function startNewTest() {
    const seed = Date.now() % 100000
    setAdaptiveSeed(seed)
    setIsBusy(true)
    setMessage("")
    setEstimate(null)
    setAdaptiveResponses([])
    try {
      setAdaptiveSession(await createAdaptiveSession(seed))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试题生成失败")
      setAdaptiveSession(null)
    } finally {
      setIsBusy(false)
    }
  }

  async function answerCurrentWord(status: AdaptiveResponseStatus) {
    if (!adaptiveSession || !currentWord) {
      setMessage("请先生成测试题")
      return
    }
    const previousResponses = adaptiveResponses
    const nextResponses = [...adaptiveResponses, { word: currentWord.word, status }]
    setAdaptiveResponses(nextResponses)
    setIsBusy(true)
    setMessage("")
    try {
      const next = await answerAdaptiveSession(adaptiveSession.session_id, nextResponses, adaptiveSeed)
      setAdaptiveSession(next)
      if (next.completed && next.estimate) {
        setEstimate(next.estimate)
        setMessage("测试完成")
      }
    } catch (error) {
      setAdaptiveResponses(previousResponses)
      setMessage(error instanceof Error ? error.message : "估算失败")
    } finally {
      setIsBusy(false)
    }
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
      setEstimate({
        estimate: job.estimate,
        range_low: job.range_low,
        range_high: job.range_high,
        confidence: job.confidence,
        method: "api_batch_job",
        sample_size: job.row_count,
        ignored_words: job.ignored_count ? [`ignored_count=${job.ignored_count}`] : [],
      })
      setMessage(`批处理任务 #${job.id} 已保存`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批处理失败")
    } finally {
      setIsBusy(false)
    }
  }

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

  async function saveCurrentResult() {
    if (!estimate) {
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
        estimate: estimate.estimate,
        range_low: estimate.range_low,
        range_high: estimate.range_high,
        confidence: estimate.confidence,
        method: estimate.method,
        responses: responsePayload,
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
    <main className="min-h-screen px-5 py-6 md:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">vocab-estimator</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              英语词汇量估算、CSV 批处理、学生测试记录与验证实验的统一演示界面。
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 text-center lg:w-auto lg:min-w-[32rem] lg:grid-cols-4">
            <Metric label="当前 rank" value={currentWord ? currentWord.rank.toString() : "--"} />
            <Metric label="已回答" value={`${answeredCount}/${totalWords || "--"}`} />
            <Metric label="进度" value={progressLabel} />
            <Metric label="估计值" value={estimate ? estimate.estimate.toString() : "--"} />
          </div>
        </header>

        {message ? (
          <Alert>
            <AlertTitle>状态</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="test" onClick={() => setActiveTab("test")}>词汇测试</TabsTrigger>
            <TabsTrigger value="batch" onClick={() => setActiveTab("batch")}>批处理</TabsTrigger>
            <TabsTrigger value="students" onClick={() => setActiveTab("students")}>学生记录</TabsTrigger>
            <TabsTrigger value="reports" onClick={() => setActiveTab("reports")}>实验输出</TabsTrigger>
          </TabsList>

          <TabsContent value="test">
            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <CardTitle>自适应词汇测试</CardTitle>
                      <CardDescription>{adaptiveSession ? `Session ${adaptiveSession.session_id}` : "等待生成测试题"}</CardDescription>
                    </div>
                    <Badge variant={adaptiveSession?.completed ? "secondary" : "outline"}>
                      {adaptiveSession?.completed ? "已完成" : "逐词动态调整"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 pt-6">
                  <div className="flex flex-col gap-2">
                    <Progress value={progress} />
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{`已回答 ${answeredCount} / ${totalWords} 个词`}</span>
                      <span>{`下一题目标 rank ${adaptiveSession?.target_rank ?? "--"}`}</span>
                    </div>
                  </div>

                  <div className="flex min-h-80 flex-col items-center justify-center gap-6 rounded-md border border-border bg-background px-5 py-8 text-center">
                    {currentWord ? (
                      <>
                        <Badge variant="secondary" className="px-3">rank {currentWord.rank}</Badge>
                        <div className="flex flex-col gap-2">
                          <span className="font-mono text-5xl font-semibold leading-none sm:text-7xl">
                            {currentWord.word}
                          </span>
                          <span className="text-sm text-muted-foreground">根据上一题结果实时选择下一题难度</span>
                        </div>
                        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                          <Button size="lg" onClick={() => answerCurrentWord("known")} disabled={isBusy}>
                            <CheckCircle2 data-icon="inline-start" />
                            认识
                          </Button>
                          <Button size="lg" variant="secondary" onClick={() => answerCurrentWord("uncertain")} disabled={isBusy}>
                            <CircleHelp data-icon="inline-start" />
                            不确定
                          </Button>
                          <Button size="lg" variant="destructive" onClick={() => answerCurrentWord("unknown")} disabled={isBusy}>
                            <XCircle data-icon="inline-start" />
                            不认识
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Empty className="min-h-56 p-8">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Database />
                          </EmptyMedia>
                          <EmptyTitle>{estimate ? "测试完成" : "等待测试题"}</EmptyTitle>
                          <EmptyDescription>{estimate ? "右侧已经生成估算结果。" : "点击新测试重新生成自适应词汇测试。"}</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>

                  {adaptiveResponses.length ? (
                    <div className="flex flex-wrap gap-2">
                      {adaptiveResponses.slice(-8).map((response, index) => (
                        <Badge key={`${response.word}-${index}`} variant={response.status === "known" ? "default" : response.status === "unknown" ? "destructive" : "secondary"}>
                          {response.word} · {statusLabel(response.status)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={startNewTest} disabled={isBusy}>
                      <RotateCcw data-icon="inline-start" />
                      新测试
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <ResultCard
                estimate={estimate}
                answeredCount={answeredCount}
                totalWords={totalWords}
                progress={progress}
                statusLabel={adaptiveSession?.completed ? "已完成" : "进行中"}
              />
            </div>
          </TabsContent>

          <TabsContent value="batch">
            <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>CSV 批处理估算</CardTitle>
                  <CardDescription>拖拽或选择 CSV 文件；每行使用 word,status，status 支持 known 或 unknown。</CardDescription>
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
                          "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-background px-4 py-8 text-center transition-colors",
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
                      <FieldDescription>格式：word,status；status 支持 known/unknown 或 认识/不认识。</FieldDescription>
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
              <ResultCard
                estimate={estimate}
                answeredCount={answeredCount}
                totalWords={totalWords}
                progress={progress}
                statusLabel={adaptiveSession?.completed ? "已完成" : "进行中"}
              />
            </div>
          </TabsContent>

          <TabsContent value="students">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardHeader>
                  <CardTitle>保存当前测试</CardTitle>
                  <CardDescription>记录代号、四六级成绩和最近一次估算结果。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="姓名或代号" />
                  <Input value={cet4Score} onChange={(event) => setCet4Score(event.target.value)} placeholder="四级成绩" type="number" />
                  <Input value={cet6Score} onChange={(event) => setCet6Score(event.target.value)} placeholder="六级成绩" type="number" />
                  <Button onClick={saveCurrentResult} disabled={isBusy}>
                    <Save data-icon="inline-start" />
                    保存记录
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>测试记录</CardTitle>
                  <CardDescription>用于后续分析四六级成绩和估算词汇量的关系。</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>代号</TableHead>
                        <TableHead>四级</TableHead>
                        <TableHead>六级</TableHead>
                        <TableHead>估计</TableHead>
                        <TableHead>置信度</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>{result.student_code}</TableCell>
                          <TableCell>{result.cet4_score ?? "--"}</TableCell>
                          <TableCell>{result.cet6_score ?? "--"}</TableCell>
                          <TableCell>{result.estimate}</TableCell>
                          <TableCell>{result.confidence}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid gap-5 xl:grid-cols-2">
              <ReportTable title="四类语料文本估计" rows={reports?.text_estimates ?? []} columns={["text_path", "estimate", "range_low", "range_high", "confidence"]} />
              <ReportTable title="四类学员画像估计" rows={reports?.learner_profiles ?? []} columns={["learner_class", "estimate", "range_low", "range_high", "confidence"]} />
              <ReportTable title="稳定性实验摘要" rows={reports?.stability_summary ?? []} columns={["unknown_ratio", "sample_length", "estimate_mean", "estimate_stddev", "range_width_mean"]} />
              <ReportTable title="学生测试样例摘要" rows={reports?.student_summary ?? []} columns={["student_code", "runs", "cet4_score", "cet6_score", "estimate_mean"]} />
              <CorrelationCard values={reports?.student_correlation ?? {}} />
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  )
}

function statusLabel(status: AdaptiveResponseStatus) {
  if (status === "known") {
    return "认识"
  }
  if (status === "unknown") {
    return "不认识"
  }
  return "不确定"
}

function CorrelationCard({ values }: { values: Record<string, string | number | null> }) {
  const rows = Object.entries(values).filter(([key]) => key !== "note")
  return (
    <Card>
      <CardHeader>
        <CardTitle>四六级相关性</CardTitle>
        <CardDescription>{rows.length ? "匿名样例数据" : "暂无输出"}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>指标</TableHead>
              <TableHead>值</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell>{key}</TableCell>
                <TableCell>{value ?? "--"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ReportTable({ title, rows, columns }: { title: string; rows: Record<string, string>[]; columns: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length ? `${rows.length} 行` : "暂无输出"}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 6).map((row, index) => (
              <TableRow key={`${title}-${index}`}>
                {columns.map((column) => (
                  <TableCell key={column}>{row[column] ?? "--"}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-20 flex-col justify-center gap-1 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="text-2xl leading-none">{value}</strong>
    </div>
  )
}

function ResultCard({
  estimate,
  answeredCount,
  totalWords,
  progress,
  statusLabel: testStatusLabel,
}: {
  estimate: EstimateResult | null
  answeredCount: number
  totalWords: number
  progress: number
  statusLabel: string
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
            <div className="flex items-end gap-3">
              <span className="text-5xl font-semibold">{estimate.estimate}</span>
              <Badge variant="secondary">{estimate.method}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="范围下限" value={estimate.range_low.toString()} />
              <Metric label="范围上限" value={estimate.range_high.toString()} />
              <Metric label="置信度" value={estimate.confidence.toString()} />
              <Metric label="样本量" value={estimate.sample_size.toString()} />
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
                <p className="text-sm text-muted-foreground">完成自适应测试后会生成估算结果。</p>
              </div>
              <Badge variant="outline">{testStatusLabel}</Badge>
            </div>
            <Progress value={progress} />
            <div className="grid grid-cols-2 gap-3">
              <Metric label="已完成" value={`${answeredCount}/${totalWords || "--"}`} />
              <Metric label="当前进度" value={progressLabel} />
              <Metric label="估计范围" value="--" />
              <Metric label="置信度" value="--" />
            </div>
            <Empty className="min-h-40 border bg-background p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database />
                </EmptyMedia>
                <EmptyTitle>等待测试或批处理结果</EmptyTitle>
                <EmptyDescription>完成测试或上传 CSV 后，这里会显示词汇量、范围和置信度。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
