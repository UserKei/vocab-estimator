import { CheckCircle2, CircleHelp, Database, RotateCcw, XCircle } from "lucide-react"
import { ResultCard } from "@/components/result-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { statusLabel, useAdaptiveTest } from "@/hooks/use-adaptive-test"

export function TestPage() {
  const {
    adaptiveResponses,
    adaptiveSession,
    answerCurrentWord,
    answeredCount,
    currentWord,
    estimate,
    isBusy,
    message,
    progress,
    startNewTest,
    totalWords,
  } = useAdaptiveTest()

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
                <CardTitle>一词一屏词汇测试</CardTitle>
                <CardDescription>
                  {adaptiveSession ? `Session ${adaptiveSession.session_id}` : "等待生成测试题"}
                </CardDescription>
              </div>
              <Badge variant={adaptiveSession?.completed ? "secondary" : "outline"}>
                {adaptiveSession?.completed ? "已完成" : "动态调整难度"}
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
                    <span className="text-sm text-muted-foreground">选择后系统会根据结果实时决定下一题 rank。</span>
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
                  <Badge
                    key={`${response.word}-${index}`}
                    variant={response.status === "known" ? "default" : response.status === "unknown" ? "destructive" : "secondary"}
                  >
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
    </>
  )
}
