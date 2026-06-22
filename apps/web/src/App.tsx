import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react"
import { BookOpenCheck, Database, FileUp, RotateCcw, Save, Upload } from "lucide-react"
import {
  createTestSession,
  estimateTestSession,
  fetchReportOutputs,
  listStudentResults,
  requestNextStage,
  saveStudentResult,
  uploadBatchCsv,
  type EstimateResult,
  type ReportOutputs,
  type StudentResult,
  type TestSession,
} from "./api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type ResponseMap = Record<string, boolean | undefined>
type PageToken = number | "ellipsis-start" | "ellipsis-end"

const TEST_WORDS_PER_PAGE = 8

export function App() {
  const [session, setSession] = useState<TestSession | null>(null)
  const [responses, setResponses] = useState<ResponseMap>({})
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [isBatchDragActive, setIsBatchDragActive] = useState(false)
  const [wordPage, setWordPage] = useState(1)
  const [studentCode, setStudentCode] = useState("S001")
  const [cet4Score, setCet4Score] = useState("")
  const [cet6Score, setCet6Score] = useState("")
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [reports, setReports] = useState<ReportOutputs | null>(null)
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)
  const [activeTab, setActiveTab] = useState("test")

  const currentWords = session?.words ?? []
  const answeredCount = currentWords.filter((word) => responses[word.word] !== undefined).length
  const progress = currentWords.length ? (answeredCount / currentWords.length) * 100 : 0
  const totalWordPages = Math.max(1, Math.ceil(currentWords.length / TEST_WORDS_PER_PAGE))
  const currentWordPage = Math.min(wordPage, totalWordPages)
  const wordPageStart = currentWords.length ? (currentWordPage - 1) * TEST_WORDS_PER_PAGE : 0
  const wordPageEnd = Math.min(wordPageStart + TEST_WORDS_PER_PAGE, currentWords.length)
  const visibleWords = currentWords.slice(wordPageStart, wordPageEnd)
  const wordPageRangeLabel = currentWords.length ? `本页 ${wordPageStart + 1}-${wordPageEnd} / 共 ${currentWords.length} 个词` : "暂无词汇"
  const responsePayload = useMemo(
    () => Object.entries(responses).flatMap(([word, known]) => (known === undefined ? [] : [{ word, known: Boolean(known) }])),
    [responses],
  )

  useEffect(() => {
    void startNewTest()
    void refreshStudentResults()
    void refreshReports()
  }, [])

  useEffect(() => {
    setWordPage(1)
  }, [session?.session_id, session?.stage])

  useEffect(() => {
    setWordPage((current) => Math.min(current, totalWordPages))
  }, [totalWordPages])

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
    setIsBusy(true)
    setMessage("")
    setEstimate(null)
    setResponses({})
    setWordPage(1)
    try {
      setSession(await createTestSession(Date.now() % 100000))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试题生成失败")
      setSession(null)
    } finally {
      setIsBusy(false)
    }
  }

  async function submitCurrentStage() {
    if (!session) {
      setMessage("请先生成测试题")
      return
    }
    if (!currentWords.length || answeredCount < currentWords.length) {
      setMessage("请完成当前阶段全部分页词汇标记")
      return
    }
    setIsBusy(true)
    setMessage("")
    try {
      if (session.stage === 1) {
        const next = await requestNextStage(session.session_id, responsePayload, Date.now() % 100000)
        setWordPage(1)
        setSession(next)
        setMessage("已进入第二阶段")
        return
      }
      setEstimate(await estimateTestSession(session.session_id, responsePayload))
      setMessage("测试完成")
    } catch (error) {
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
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="阶段" value={session ? session.stage.toString() : "--"} />
            <Metric label="已标记" value={`${answeredCount}/${currentWords.length || "--"}`} />
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
                <CardHeader>
                  <CardTitle>两阶段词汇测试</CardTitle>
                  <CardDescription>{session ? `Session ${session.session_id}` : "等待生成测试题"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Progress value={progress} />
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{`第 ${currentWordPage} / ${totalWordPages} 页`}</span>
                      <span>{wordPageRangeLabel}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleWords.map((item) => (
                      <div key={`${item.stage}-${item.word}`} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm">{item.word}</span>
                          <span className="text-xs text-muted-foreground">rank {item.rank}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={responses[item.word] === true ? "default" : "outline"}
                            onClick={() => setResponses((current) => ({ ...current, [item.word]: true }))}
                          >
                            认识
                          </Button>
                          <Button
                            size="sm"
                            variant={responses[item.word] === false ? "destructive" : "outline"}
                            onClick={() => setResponses((current) => ({ ...current, [item.word]: false }))}
                          >
                            不认识
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalWordPages > 1 ? (
                    <TestWordPagination page={currentWordPage} totalPages={totalWordPages} onPageChange={setWordPage} />
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={submitCurrentStage} disabled={isBusy || !session}>
                      <BookOpenCheck data-icon="inline-start" />
                      {session?.stage === 1 ? "提交第一阶段" : "完成测试"}
                    </Button>
                    <Button variant="outline" onClick={startNewTest} disabled={isBusy}>
                      <RotateCcw data-icon="inline-start" />
                      新测试
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <ResultCard estimate={estimate} />
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
              <ResultCard estimate={estimate} />
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

function TestWordPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const pageTokens = buildPageTokens(page, totalPages)

  function navigate(event: MouseEvent<HTMLAnchorElement>, nextPage: number) {
    event.preventDefault()
    onPageChange(Math.max(1, Math.min(totalPages, nextPage)))
  }

  return (
    <Pagination>
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-label="上一页"
            aria-disabled={page === 1}
            tabIndex={page === 1 ? -1 : undefined}
            text="上一页"
            className={cn(page === 1 && "pointer-events-none opacity-50")}
            onClick={(event) => navigate(event, page - 1)}
          />
        </PaginationItem>
        {pageTokens.map((token) => (
          <PaginationItem key={token}>
            {typeof token === "number" ? (
              <PaginationLink
                href="#"
                aria-label={`第 ${token} 页`}
                isActive={token === page}
                onClick={(event) => navigate(event, token)}
              >
                {token}
              </PaginationLink>
            ) : (
              <PaginationEllipsis />
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-label="下一页"
            aria-disabled={page === totalPages}
            tabIndex={page === totalPages ? -1 : undefined}
            text="下一页"
            className={cn(page === totalPages && "pointer-events-none opacity-50")}
            onClick={(event) => navigate(event, page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function buildPageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const visiblePages = new Set(
    [1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter((page) => page >= 1 && page <= totalPages),
  )
  const sortedPages = [...visiblePages].sort((left, right) => left - right)
  const tokens: PageToken[] = []
  let ellipsisCount = 0

  for (const page of sortedPages) {
    const previous = tokens.at(-1)
    if (typeof previous === "number" && page - previous > 1) {
      if (page - previous === 2) {
        tokens.push(previous + 1)
      } else {
        tokens.push(ellipsisCount === 0 ? "ellipsis-start" : "ellipsis-end")
        ellipsisCount += 1
      }
    }
    tokens.push(page)
  }

  return tokens
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
    <Card className="min-w-24">
      <CardContent className="flex flex-col gap-1 p-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <strong className="text-2xl leading-none">{value}</strong>
      </CardContent>
    </Card>
  )
}

function ResultCard({ estimate }: { estimate: EstimateResult | null }) {
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
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-background p-6 text-center">
            <Database className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">等待测试或批处理结果</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
