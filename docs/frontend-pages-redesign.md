# 前端多页面重写技术方案

## 背景

原始课程需求要求工具具备 GUI 演示、后台批处理、学生测试记录和实验输出查看能力。早期前端把这些能力放在同一个页面的四个 Tabs 内，随着词汇测试、拖拽上传、学生记录和报告表格逐步增多，单页内容过长，页面职责也不够清晰。

本次在现有 Vite + React + shadcn/ui 项目内重写前端页面结构，不迁移 Next.js，不改后端业务接口，不改算法和数据库 schema。

## 社区方案参考

- React Router 官方推荐使用 `BrowserRouter`、`Routes`、`Route`、`Outlet` 组织 SPA 路由和 layout routes。
- shadcn Sidebar 的定位是可组合、可主题化、可折叠的应用侧边栏，适合课程工具台这种多功能入口。
- shadcn Breadcrumb 用于显示当前页面层级，适合从 Tabs 迁移到独立页面后提示当前位置。
- shadcn Data Table 官方建议基于 `Table` 和 `@tanstack/react-table` 组合实现分页、排序等表格能力。

参考链接：

- React Router routing: <https://reactrouter.com/start/declarative/routing>
- shadcn Sidebar: <https://ui.shadcn.com/docs/components/sidebar>
- shadcn Breadcrumb: <https://ui.shadcn.com/docs/components/breadcrumb>
- shadcn Data Table: <https://ui.shadcn.com/docs/components/data-table>

## 路由结构

前端仍是 Vite SPA，使用 React Router 管理页面：

- `/`：概览页，展示四个课程任务入口和最近估算摘要。
- `/test`：GUI 词汇测试，一词一屏，支持认识、不认识、不确定。
- `/batch`：后台 CSV 批处理，支持拖拽或选择 CSV 文件上传。
- `/students`：学生测试记录，保存姓名或代号、四六级成绩、估算结果，表格分页展示。
- `/reports`：实验输出和验证结果，展示 C/F/P/K、稳定性摘要、学生相关性等报告材料。

`App.tsx` 只保留路由定义，页面公共壳由 `AppShell` 负责。

## Layout 方案

布局使用 shadcn CLI 安装的组件组合：

- `SidebarProvider`、`Sidebar`、`SidebarInset`：提供应用侧栏和主内容区域。
- `SidebarMenuButton`：承载页面导航项和 active 状态。
- `Breadcrumb`：展示 `首页 / 当前页面`。
- `Separator`：分隔顶部工具栏。
- `sonner`：保留 toast 能力。

shadcn 组件源码由 CLI 生成后直接使用，业务组合逻辑放在 `src/components/`、`src/pages/` 和 `src/hooks/`，避免把业务样式写进 `components/ui/*`。

## 页面职责

### 概览页

展示四个课程任务入口：

- GUI 词汇测试
- CSV 批处理
- 学生记录
- 实验输出

同时展示最近估计值、最近样本量、可保存回答数，方便演示时快速确认当前状态。

### 词汇测试页

保留后端自适应测试 API：

- 进入页面后创建 adaptive session。
- 每次只显示一个单词和 rank badge。
- 用户选择认识、不认识或不确定。
- 后端根据回答状态返回下一题和目标 rank。
- 测试完成后结果卡展示估计词汇量、范围、置信度和样本量。

这个交互更接近 TestYourVocab 一类公开词汇量测试网站的逐题体验，也避免一屏展示大量固定词。

### 批处理页

按原始需求里的后台批处理测试思路实现：

- 上传 CSV 文件，而不是在页面中粘贴大段文本。
- 格式为 `word,status`。
- `status` 支持 `known`、`unknown`，后端也兼容中文状态。
- 上传后调用 `/api/batch`，结果卡展示估算结果。

### 学生记录页

对应原始需求中的 GUI 实例测试结果和报告数据：

- 保存姓名或代号。
- 保存四级成绩、六级成绩。
- 保存最近一次估算结果。
- 使用 TanStack Table 做本地分页，避免记录增多后页面过长。

### 实验输出页

对应报告材料：

- 四类语料文本估计。
- 四类学员画像估计。
- 稳定性实验摘要。
- 学生测试样例摘要。
- 四六级成绩与估计词汇量相关性。

表格统一复用 `DataTable`，默认每页 5 行。

## 端口与部署

本地开发读取根目录 `.env` 或 `.env.example`：

- `VOCAB_API_PORT=8000`
- `VOCAB_WEB_PORT=5010`

Vite 默认端口也对齐为 5010。Docker 部署仍由 Nginx 暴露 80 端口，并保留 SPA fallback，刷新 `/test`、`/batch`、`/students`、`/reports` 不会丢路由。

## 验证

本次重写覆盖以下验证：

- `pnpm web:test`
- `pnpm web:build`
- `.venv/bin/python -m pytest -q`
- `docker compose config --quiet`
- `docker compose -f docker-compose.infra.yml config --quiet`
- `bash -n deploy.sh prepare-server.sh`

前端测试覆盖：

- Sidebar 导航和 React Router 页面入口。
- `/test` 创建 adaptive session，并能提交认识和不确定状态。
- `/batch` 使用 `FormData` 上传 CSV 文件。
- `/students` 展示分页表格，并在没有估算结果时提示先完成估算。
- `/reports` 展示报告表格和相关性指标。
