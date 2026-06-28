import { ArrowRight, BookOpenCheck, FileUp, FlaskConical, Users } from "lucide-react"
import { Link } from "react-router"
import { MetricCard } from "@/components/metric-card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAppState } from "@/state"

const taskCards = [
  {
    title: "GUI 词汇测试",
    description: "一词一屏，按认识、不认识、不确定推进，自适应调整下一题难度。",
    href: "/test",
    icon: BookOpenCheck,
  },
  {
    title: "CSV 批处理",
    description: "上传 word,status 格式文件，复现实验里的后台批量估算流程。",
    href: "/batch",
    icon: FileUp,
  },
  {
    title: "学生记录",
    description: "保存姓名或代号、四六级成绩、测试时间和多次测试结果。",
    href: "/students",
    icon: Users,
  },
  {
    title: "实验输出",
    description: "查看四类语料估计、稳定性实验和相关性摘要。",
    href: "/reports",
    icon: FlaskConical,
  },
]

export function OverviewPage() {
  const { latestEstimate, latestResponses } = useAppState()

  return (
    <>
      <PageHeader
        title="课程任务概览"
        description="英语词汇量估算、CSV 批处理、学生测试记录与验证实验的统一演示界面。"
        badge="React Router + shadcn"
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="最近估计值" value={latestEstimate ? latestEstimate.estimate.toString() : "--"} />
        <MetricCard label="最近样本量" value={latestEstimate ? latestEstimate.sample_size.toString() : "--"} />
        <MetricCard label="可保存回答" value={latestResponses.length.toString()} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {taskCards.map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <CardAction>
                <item.icon />
              </CardAction>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Separator />
              <Button asChild variant="outline">
                <Link to={item.href}>
                  进入页面
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  )
}
