import { useEffect, useMemo, useState } from "react"
import { BookOpenCheck, Database, RotateCcw, Save, Upload } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ResponseMap = Record<string, boolean | undefined>

export function App() {
  const [session, setSession] = useState<TestSession | null>(null)
  const [responses, setResponses] = useState<ResponseMap>({})
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [batchText, setBatchText] = useState("word,status\n")
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
  const responsePayload = useMemo(
    () => Object.entries(responses).flatMap(([word, known]) => (known === undefined ? [] : [{ word, known: Boolean(known) }])),
    [responses],
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
    setIsBusy(true)
    setMessage("")
    setEstimate(null)
    setResponses({})
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
      setMessage("请完成当前阶段的全部标记")
      return
    }
    setIsBusy(true)
    setMessage("")
    try {
      if (session.stage === 1) {
        const next = await requestNextStage(session.session_id, responsePayload, Date.now() % 100000)
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
    if (!batchText.trim()) {
      setMessage("批处理文本不能为空")
      return
    }
    setIsBusy(true)
    setMessage("")
    try {
      const job = await uploadBatchCsv(batchText)
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
            <Badge variant="outline" className="w-fit">课程设计工具台</Badge>
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
                  <Progress value={progress} />
                  <div className="grid gap-3 md:grid-cols-2">
                    {currentWords.map((item) => (
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
                            variant={responses[item.word] === false ? "secondary" : "outline"}
                            onClick={() => setResponses((current) => ({ ...current, [item.word]: false }))}
                          >
                            不认识
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <CardDescription>每行使用 word,status，status 支持 known 或 unknown。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Textarea value={batchText} onChange={(event) => setBatchText(event.target.value)} />
                  <Button onClick={runBatchEstimate} disabled={isBusy}>
                    <Upload data-icon="inline-start" />
                    上传批处理
                  </Button>
                </CardContent>
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
