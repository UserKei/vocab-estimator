import { CheckCircle2, Database, RotateCcw, XCircle } from "lucide-react"
import { ResultCard } from "@/components/result-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { responseLabel, responseVariant, useTwoStageTest } from "@/hooks/use-two-stage-test"

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
    session,
    stage,
    startNewTest,
    totalWords,
  } = useTwoStageTest()

  return (
    <>
      {message ? (
        <Alert>
          <AlertTitle>状态</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>150 词两阶段词汇测试</CardTitle>
                <CardDescription>
                  {session ? `Session ${session.session_id}` : estimate ? "测试完成" : "等待生成测试题"}
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
          statusLabel={estimate ? "已完成" : `阶段 ${stage}`}
          pendingDescription="完成 150 词测试后会生成估算结果。"
        />
      </div>
    </>
  )
}
