import { useCallback, useEffect, useState } from "react"
import { listStudentResults, type StudentResultsPage } from "@/api"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const PAGE_SIZE = 5

const emptyPage: StudentResultsPage = {
  items: [],
  total: 0,
  page: 1,
  page_size: PAGE_SIZE,
  pages: 0,
}

export function StudentsPage() {
  const [recordsPage, setRecordsPage] = useState<StudentResultsPage>(emptyPage)
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const refreshRecords = useCallback(async (nextPage: number) => {
    setIsBusy(true)
    setMessage("")
    try {
      const nextRecordsPage = await listStudentResults(nextPage, PAGE_SIZE)
      setRecordsPage(nextRecordsPage)
      setPage(nextRecordsPage.page)
    } catch (error) {
      setRecordsPage({ ...emptyPage, page: nextPage })
      setMessage(error instanceof Error ? error.message : "测试记录加载失败")
    } finally {
      setIsBusy(false)
    }
  }, [])

  useEffect(() => {
    void refreshRecords(1)
  }, [refreshRecords])

  function goToPage(nextPage: number) {
    if (isBusy || nextPage < 1 || (recordsPage.pages && nextPage > recordsPage.pages)) {
      return
    }
    void refreshRecords(nextPage)
  }

  const hasPreviousPage = page > 1
  const hasNextPage = recordsPage.pages ? page < recordsPage.pages : false

  return (
    <>
      <PageHeader
        title="测试记录"
        description="查看同学完成 150 词测评后自动保存到数据库的真实记录，支持后端分页查询。"
        badge="数据库记录"
      />
      {message ? (
        <Alert>
          <AlertTitle>状态</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>测试记录</CardTitle>
          <CardDescription>从数据库分页查询正式词汇测试保存结果。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>四级</TableHead>
                  <TableHead>六级</TableHead>
                  <TableHead>估计</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>测试时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsPage.items.length ? (
                  recordsPage.items.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.student_code}</TableCell>
                      <TableCell>{record.student_name}</TableCell>
                      <TableCell>{record.cet4_score ?? "--"}</TableCell>
                      <TableCell>{record.cet6_score ?? "--"}</TableCell>
                      <TableCell>{record.estimate}</TableCell>
                      <TableCell>{record.confidence}</TableCell>
                      <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {isBusy ? "加载测试记录中" : "暂无测试记录"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{`共 ${recordsPage.total} 条，当前第 ${recordsPage.pages ? page : 0} / ${recordsPage.pages} 页`}</span>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="上一页"
                    aria-disabled={!hasPreviousPage}
                    onClick={(event) => {
                      event.preventDefault()
                      goToPage(page - 1)
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.max(1, recordsPage.pages) }, (_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      href="#"
                      isActive={index + 1 === page}
                      onClick={(event) => {
                        event.preventDefault()
                        goToPage(index + 1)
                      }}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="下一页"
                    aria-disabled={!hasNextPage}
                    onClick={(event) => {
                      event.preventDefault()
                      goToPage(page + 1)
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
