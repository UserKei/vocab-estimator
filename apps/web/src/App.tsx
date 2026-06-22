import { useEffect, useMemo, useState } from "react"
import { BookOpenCheck, Database, RotateCcw, Save, Upload } from "lucide-react"
import { estimateVocabulary, listStudentResults, saveStudentResult, type EstimateResult, type StudentResult } from "./api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const initialWords = [
  "apple",
  "however",
  "research",
  "economy",
  "recite",
  "exemplify",
  "oblivion",
  "meticulous",
]

type ResponseMap = Record<string, boolean | undefined>

export function App() {
  const [responses, setResponses] = useState<ResponseMap>({})
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [batchText, setBatchText] = useState("apple,known\nrecite,known\nexemplify,unknown\noblivion,unknown")
  const [studentCode, setStudentCode] = useState("S001")
  const [cet4Score, setCet4Score] = useState("")
  const [cet6Score, setCet6Score] = useState("")
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const answeredCount = Object.values(responses).filter((value) => value !== undefined).length
  const progress = (answeredCount / initialWords.length) * 100
  const responsePayload = useMemo(
    () => initialWords.flatMap((word) => (responses[word] === undefined ? [] : [{ word, known: Boolean(responses[word]) }])),
    [responses],
  )

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

  async function runEstimate() {
    setMessage("")
    if (responsePayload.length === 0) {
      setMessage("请至少标记一个单词")
      return
    }
    setIsBusy(true)
    try {
      setEstimate(await estimateVocabulary(responsePayload))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "估算失败")
    } finally {
      setIsBusy(false)
    }
  }

  async function runBatchEstimate() {
    const parsed = parseBatchText(batchText)
    if (parsed.length === 0) {
      setMessage("批处理文本不能为空")
      return
    }
    setIsBusy(true)
    setMessage("")
    try {
      setEstimate(await estimateVocabulary(parsed))
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

  function resetTest() {
    setResponses({})
    setEstimate(null)
    setMessage("")
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
            <Metric label="样本词" value={initialWords.length.toString()} />
            <Metric label="已标记" value={answeredCount.toString()} />
            <Metric label="估计值" value={estimate ? estimate.estimate.toString() : "--"} />
          </div>
        </header>

        {message ? (
          <Alert>
            <AlertTitle>状态</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="test" className="w-full">
          <TabsList>
            <TabsTrigger value="test">词汇测试</TabsTrigger>
            <TabsTrigger value="batch">批处理</TabsTrigger>
            <TabsTrigger value="students">学生记录</TabsTrigger>
          </TabsList>

          <TabsContent value="test">
            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <CardHeader>
                  <CardTitle>认识状态标记</CardTitle>
                  <CardDescription>逐词选择认识或不认识，然后提交估算。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Progress value={progress} />
                  <div className="grid gap-3 md:grid-cols-2">
                    {initialWords.map((word) => (
                      <div key={word} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                        <span className="font-mono text-sm">{word}</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={responses[word] === true ? "default" : "outline"}
                            onClick={() => setResponses((current) => ({ ...current, [word]: true }))}
                          >
                            认识
                          </Button>
                          <Button
                            size="sm"
                            variant={responses[word] === false ? "secondary" : "outline"}
                            onClick={() => setResponses((current) => ({ ...current, [word]: false }))}
                          >
                            不认识
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={runEstimate} disabled={isBusy}>
                      <BookOpenCheck data-icon="inline-start" />
                      开始估算
                    </Button>
                    <Button variant="outline" onClick={resetTest}>
                      <RotateCcw data-icon="inline-start" />
                      重置
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
                    运行批处理
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
        </Tabs>
      </section>
    </main>
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

function parseBatchText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [word, status] = line.split(",").map((part) => part.trim())
      return { word, known: ["known", "yes", "true", "1", "认识"].includes(status.toLowerCase()) }
    })
    .filter((item) => item.word)
}

