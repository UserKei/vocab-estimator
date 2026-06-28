import { useCallback, useEffect, useState, type FormEvent } from "react"
import { CheckCircle2, Database, RotateCcw, XCircle } from "lucide-react"
import { saveStudentResult, type EstimateResult, type EstimateResponseInput } from "@/api"
import { ResultCard } from "@/components/result-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { responseLabel, responseVariant, useTwoStageTest } from "@/hooks/use-two-stage-test"

type ParticipantInfo = {
  studentCode: string
  studentName: string
  cet4Score: number | null
  cet6Score: number | null
}

export function TestPage() {
  const {
    answerCurrentWord,
    answeredCount,
    currentWord,
    estimate,
    isBusy,
    message,
    progress,
    responses,
    resetTest,
    session,
    stage,
    startNewTest,
    totalWords,
  } = useTwoStageTest()
  const [studentCode, setStudentCode] = useState("")
  const [studentName, setStudentName] = useState("")
  const [cet4Score, setCet4Score] = useState("")
  const [cet6Score, setCet6Score] = useState("")
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null)
  const [formError, setFormError] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [saveError, setSaveError] = useState("")

  const saveCompletedResult = useCallback(async (
    nextEstimate: EstimateResult,
    nextResponses: EstimateResponseInput[],
    nextParticipant: ParticipantInfo,
  ) => {
    setSaveStatus("saving")
    setSaveError("")
    try {
      await saveStudentResult({
        student_code: nextParticipant.studentCode,
        student_name: nextParticipant.studentName,
        cet4_score: nextParticipant.cet4Score,
        cet6_score: nextParticipant.cet6Score,
        estimate: nextEstimate.estimate,
        range_low: nextEstimate.range_low,
        range_high: nextEstimate.range_high,
        confidence: nextEstimate.confidence,
        method: nextEstimate.method,
        responses: nextResponses,
      })
      setSaveStatus("saved")
    } catch (error) {
      setSaveStatus("failed")
      setSaveError(error instanceof Error ? error.message : "测试记录保存失败")
    }
  }, [])

  useEffect(() => {
    if (estimate && participant && saveStatus === "idle") {
      void saveCompletedResult(estimate, responses, participant)
    }
  }, [estimate, participant, responses, saveCompletedResult, saveStatus])

  async function handleStartTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextStudentCode = studentCode.trim()
    const nextStudentName = studentName.trim()
    const nextCet4Score = parseOptionalScore(cet4Score)
    const nextCet6Score = parseOptionalScore(cet6Score)

    if (!nextStudentCode || !nextStudentName) {
      setFormError("请填写学号和姓名")
      return
    }
    if (nextCet4Score === "invalid" || nextCet6Score === "invalid") {
      setFormError("四六级成绩需要是 0-710 的整数")
      return
    }

    setFormError("")
    setSaveStatus("idle")
    setSaveError("")
    setParticipant({
      studentCode: nextStudentCode,
      studentName: nextStudentName,
      cet4Score: nextCet4Score,
      cet6Score: nextCet6Score,
    })
    await startNewTest()
  }

  function resetToForm() {
    resetTest()
    setParticipant(null)
    setFormError("")
    setSaveStatus("idle")
    setSaveError("")
  }

  const statusMessage = formError
    || (saveStatus === "saved" ? "测试记录已保存" : "")
    || (saveStatus === "saving" ? "测试记录保存中" : "")
    || saveError
    || message

  if (!participant) {
    return (
      <>
        {statusMessage ? (
          <Alert>
            <AlertTitle>状态</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Card className="max-w-5xl">
          <CardHeader>
            <CardTitle>测评信息</CardTitle>
            <CardDescription>填写学号和姓名后开始 150 词两阶段词汇测试。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleStartTest}>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(formError && !studentCode.trim())}>
                    <FieldLabel htmlFor="student-code">学号</FieldLabel>
                    <Input
                      id="student-code"
                      value={studentCode}
                      onChange={(event) => setStudentCode(event.target.value)}
                      placeholder="请输入学号"
                      aria-invalid={Boolean(formError && !studentCode.trim())}
                    />
                  </Field>
                  <Field data-invalid={Boolean(formError && !studentName.trim())}>
                    <FieldLabel htmlFor="student-name">姓名</FieldLabel>
                    <Input
                      id="student-name"
                      value={studentName}
                      onChange={(event) => setStudentName(event.target.value)}
                      placeholder="请输入姓名"
                      aria-invalid={Boolean(formError && !studentName.trim())}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cet4-score">四级成绩（选填）</FieldLabel>
                    <Input
                      id="cet4-score"
                      value={cet4Score}
                      onChange={(event) => setCet4Score(event.target.value)}
                      placeholder="四级成绩"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cet6-score">六级成绩（选填）</FieldLabel>
                    <Input
                      id="cet6-score"
                      value={cet6Score}
                      onChange={(event) => setCet6Score(event.target.value)}
                      placeholder="六级成绩"
                      inputMode="numeric"
                    />
                    <FieldDescription>成绩可留空；填写时范围为 0-710。</FieldDescription>
                  </Field>
                </div>
              </FieldGroup>
              <Button className="w-fit" type="submit" disabled={isBusy}>
                开始测评
              </Button>
            </form>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {statusMessage ? (
        <Alert>
          <AlertTitle>状态</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{statusMessage}</span>
            {saveStatus === "failed" && estimate ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveCompletedResult(estimate, responses, participant)}
              >
                重试保存
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>150 词两阶段词汇测试</CardTitle>
                <CardDescription>
                  {session ? `Session ${session.session_id}` : estimate ? "测试完成" : `${participant.studentCode} · ${participant.studentName}`}
                </CardDescription>
              </div>
              <Badge variant={estimate ? "secondary" : "outline"}>
                {estimate ? "已完成" : `阶段 ${stage}`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-6">
            <div className="flex flex-col gap-2">
              <Progress value={progress} className="[&_[data-slot=progress-indicator]]:transition-none" />
              <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{`${answeredCount}/${totalWords}`}</span>
                <span>{stage === 1 ? "第一阶段粗定位：40 词" : "第二阶段窄范围采样：110 词"}</span>
              </div>
            </div>

            <div className="flex min-h-80 flex-col items-center justify-center gap-6 rounded-md border bg-background px-5 py-8 text-center">
              {currentWord ? (
                <>
                  <Badge variant="secondary" className="px-3">
                    rank {currentWord.rank}
                  </Badge>
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-5xl font-semibold leading-none sm:text-7xl">
                      {currentWord.word}
                    </span>
                    <span className="text-sm text-muted-foreground">拿不准的词按“不认识”处理，保证 150 个答案全部参与估算。</span>
                  </div>
                  <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
                    <Button size="lg" onClick={() => answerCurrentWord(true)} disabled={isBusy}>
                      <CheckCircle2 data-icon="inline-start" />
                      认识
                    </Button>
                    <Button size="lg" variant="destructive" onClick={() => answerCurrentWord(false)} disabled={isBusy}>
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
                    <EmptyDescription>
                      {estimate ? "右侧已经生成估算结果。" : "点击新测试重新生成 150 词两阶段测试。"}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>

            {responses.length ? (
              <div className="flex flex-wrap gap-2">
                {responses.slice(-8).map((response, index) => (
                  <Badge
                    key={`${response.word}-${index}`}
                    variant={responseVariant(response)}
                  >
                    {response.word} · {responseLabel(response)}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={resetToForm} disabled={isBusy || saveStatus === "saving"}>
                <RotateCcw data-icon="inline-start" />
                重新填写信息
              </Button>
            </div>
          </CardContent>
        </Card>
        <ResultCard
          estimate={estimate}
          answeredCount={answeredCount}
          totalWords={totalWords}
          progress={progress}
          statusLabel={estimate ? "已完成" : `阶段 ${stage}`}
          pendingDescription="完成 150 词测试后会生成估算结果。"
        />
      </div>
    </>
  )
}

function parseOptionalScore(value: string): number | null | "invalid" {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (!/^\d+$/.test(trimmed)) {
    return "invalid"
  }
  const score = Number(trimmed)
  return score >= 0 && score <= 710 ? score : "invalid"
}
