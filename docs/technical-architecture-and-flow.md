# 项目业务流程与技术结构说明

## 1. 项目目标

本项目是英语词汇量估算课程设计工具，围绕原始需求实现四类能力：

- GUI 词汇量测试：同学填写学号、姓名、可选四/六级成绩后完成 150 词两阶段测评。
- 后台批处理：上传 `word,status` CSV 文件，批量估算词汇量。
- 实验验证：生成 C/F/P/K 四类语料估计、learner profile、900 次稳定性实验和图表。
- 数据保存：测试完成后自动保存测试记录，记录页从数据库分页查询。

项目不包含登录、权限、多租户和后台管理；数据重点服务课程演示、报告复现和服务器部署。

## 2. 业务流程

### 2.1 GUI 词汇测试

1. 用户进入 `/test`。
2. 前端展示测评信息表单：学号、姓名必填，四级成绩、六级成绩选填。
3. 表单校验通过后，前端调用 `POST /api/test-sessions` 请求第一阶段 40 个词。
4. 用户逐词选择“认识”或“不认识”。
5. 第一阶段完成后，前端调用 `POST /api/test-sessions/{session_id}/next` 请求第二阶段 110 个词。
6. 第二阶段完成后，前端调用 `POST /api/test-sessions/{session_id}/estimate` 得到估算结果。
7. 前端调用 `POST /api/student-results` 保存学号、姓名、成绩、估算结果和答题明细。
8. 用户可在 `/students` 查看数据库分页记录。

### 2.2 CSV 批处理

1. 用户进入 `/batch`。
2. 拖拽或选择 CSV 文件。
3. 前端以 `FormData` 调用 `POST /api/batch` 上传文件。
4. 后端解析 `word,status`，`status` 支持 `known/unknown` 和 `认识/不认识`。
5. 后端执行同一套估算算法并保存批处理任务。
6. 前端展示估算值、范围、置信度和样本量。

### 2.3 实验与报告输出

1. ECDICT 构建脚本读取 `../ref/ECDICT/ecdict.csv`。
2. 脚本筛选教育阶段 tag，生成 `data/wordlists/word_rank.csv` 和 `evaluation_wordlist.csv`。
3. 同一脚本读取 ECDICT 全量单词，生成 `data/wordlists/matching_wordlist.csv` 作为文本覆盖匹配词库。
4. 实验脚本读取词表和 `data/samples/C.txt/F.txt/P.txt/K.txt`。
5. 输出写入 `reports/outputs/`。
6. `/reports` 只展示可由命令重新生成的真实输出：文本估计、learner profile、稳定性摘要。

### 2.4 部署流程

1. 服务器首次部署前运行 `prepare-server.sh` 安装 Docker/Compose，并为小内存机器配置 swap。
2. 运行 `deploy.sh`。
3. Docker Compose 启动 PostgreSQL、FastAPI API 和 Nginx 静态前端。
4. Web 默认暴露 HTTP 80，API 由前端容器反向代理到 `/api`。

## 3. 项目结构设计

项目采用轻量 monorepo：

```text
vocab-estimator/
  apps/
    api/                 FastAPI 后端应用
    web/                 React + Vite + shadcn/ui 前端应用
  packages/
    estimator/           纯算法核心包
    experiments/         批处理、词库构建和报告实验工具
  data/
    samples/             原始需求四类测试语料
    wordlists/           生成后的词表数据
  reports/
    outputs/             报告所需可复现实验输出
  docs/                  项目方案、报告和技术文档
  tests/                 Python 后端、算法、实验和部署测试
```

设计原则：

- 算法核心不依赖 FastAPI 和 React，便于 CLI、API、测试复用。
- API 负责输入校验、数据库持久化和把算法能力暴露给前端。
- 前端只调用 API，不内置正式业务假数据。
- `reports/outputs/` 只保存可由命令重新生成的输出，不保存匿名演示数据。

## 4. 关键数据结构

### 4.1 词表

`data/wordlists/word_rank.csv` 兼容列：

- `word`：单词。
- `rank`：词表排序，从 1 开始。
- `frequency`：兼容估算算法的频率代理值。
- `source`：数据来源，目前为 `ecdict_education`。

扩展列：

- `level`：最早教育阶段，取 `zk/gk/cet4/cet6/ielts/toefl/gre`。
- `tags`：ECDICT 原始考试标签。
- `translation`：中文释义。
- `bnc`、`frq`：ECDICT 频率字段。

`data/wordlists/matching_wordlist.csv` 使用 ECDICT 全量单词，只用于文本语料估计的覆盖识别：

- `word`：可识别英文单词。
- `source`：目前为 `ecdict_full`。

文本估计时，`word_rank.csv` 决定估计 rank；`matching_wordlist.csv` 只区分“可识别但未分级”的词和真正无法识别的词。

### 4.2 数据库表

- `student_results`：一次正式 GUI 测试结果，包含学号、姓名、成绩、估算值、范围、置信度、方法和时间。
- `estimate_responses`：一次测试中的单词答题明细。
- `batch_jobs`：CSV 批处理任务结果。

## 5. 主要 API

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/api/health` | GET | 健康检查 |
| `/api/estimate` | POST | 根据答题列表直接估算 |
| `/api/test-sessions` | POST | 生成第一阶段测试词 |
| `/api/test-sessions/{id}/next` | POST | 根据第一阶段结果生成第二阶段测试词 |
| `/api/test-sessions/{id}/estimate` | POST | 提交 150 词答题并估算 |
| `/api/batch` | POST | 上传 CSV 并批处理估算 |
| `/api/student-results` | POST | 保存正式 GUI 测试记录 |
| `/api/student-results` | GET | 分页查询正式 GUI 测试记录 |
| `/api/experiments/stability` | POST | 触发稳定性实验 |
| `/api/experiments/text-estimate` | POST | 触发文本语料估计 |
| `/api/reports/outputs` | GET | 读取可复现实验输出 |

## 6. 文件职责

### 6.1 根目录

| 文件 | 作用 |
| --- | --- |
| `.env.example` | 本地开发和部署环境变量示例 |
| `AGENTS.md` | Agent 协作和 Git 仓库约定 |
| `README.md` | 项目说明、待办事项和常用命令 |
| `alembic.ini` | Alembic 数据库迁移配置 |
| `deploy.sh` | Docker Compose 部署入口 |
| `docker-compose.yml` | Web、API、PostgreSQL 完整部署编排 |
| `docker-compose.infra.yml` | 本地开发 PostgreSQL 单独启动编排 |
| `package.json` | monorepo 级 pnpm 脚本 |
| `pnpm-lock.yaml` | pnpm 锁定依赖版本 |
| `pnpm-workspace.yaml` | pnpm workspace 配置 |
| `prepare-server.sh` | Ubuntu 服务器 Docker/Compose/swap 准备脚本 |
| `pyproject.toml` | Python 项目、依赖、pytest 和包路径配置 |

### 6.2 后端 `apps/api`

| 文件 | 作用 |
| --- | --- |
| `apps/api/Dockerfile` | API 容器镜像构建 |
| `apps/api/README.md` | 后端应用说明 |
| `apps/api/migrations/README.md` | Alembic 迁移目录说明 |
| `apps/api/migrations/env.py` | Alembic 运行环境和模型导入 |
| `apps/api/migrations/script.py.mako` | Alembic 迁移脚本模板 |
| `apps/api/migrations/versions/20260622_0001_initial_schema.py` | 初始数据库表结构 |
| `apps/api/migrations/versions/20260628_0002_add_student_name.py` | 为测试记录增加姓名字段 |
| `apps/api/src/vocab_api/__init__.py` | Python 包标识 |
| `apps/api/src/vocab_api/__main__.py` | `python -m vocab_api` 启动入口 |
| `apps/api/src/vocab_api/config.py` | 环境变量读取和配置对象 |
| `apps/api/src/vocab_api/database.py` | SQLModel engine、session 和建表函数 |
| `apps/api/src/vocab_api/main.py` | FastAPI 路由、生命周期和报告读取 |
| `apps/api/src/vocab_api/models.py` | 数据库表模型 |
| `apps/api/src/vocab_api/repositories.py` | 数据库写入和分页查询 |
| `apps/api/src/vocab_api/schemas.py` | API 请求和响应模型 |
| `apps/api/src/vocab_api/services.py` | API 层调用算法包的服务函数 |

### 6.3 前端 `apps/web`

| 文件 | 作用 |
| --- | --- |
| `apps/web/Dockerfile` | 前端构建和 Nginx 镜像 |
| `apps/web/README.md` | 前端应用说明 |
| `apps/web/components.json` | shadcn/ui 配置 |
| `apps/web/index.html` | Vite HTML 入口 |
| `apps/web/nginx.conf` | 静态站点、SPA fallback 和 `/api` 代理 |
| `apps/web/package.json` | 前端依赖和脚本 |
| `apps/web/tsconfig.json` | TypeScript 配置 |
| `apps/web/vite.config.ts` | Vite、React、路径别名和测试配置 |
| `apps/web/src/App.tsx` | React Router 页面路由 |
| `apps/web/src/App.test.tsx` | 前端页面和 API 调用测试 |
| `apps/web/src/api.ts` | 前端 API 类型和请求封装 |
| `apps/web/src/main.tsx` | React 挂载入口 |
| `apps/web/src/index.css` | Tailwind v4、shadcn 主题变量和背景样式 |
| `apps/web/src/state.tsx` | 前端共享状态，保存最近一次估算结果 |
| `apps/web/src/test/setup.ts` | Vitest DOM 测试 setup |
| `apps/web/src/hooks/use-mobile.ts` | shadcn sidebar 移动端检测 hook |
| `apps/web/src/hooks/use-two-stage-test.ts` | 150 词两阶段测试状态机 |
| `apps/web/src/lib/utils.ts` | `cn` 类名合并工具 |
| `apps/web/src/components/app-shell.tsx` | 侧边栏、顶部栏和页面容器布局 |
| `apps/web/src/components/data-table.tsx` | TanStack Table 本地分页表格 |
| `apps/web/src/components/metric-card.tsx` | 小指标卡片 |
| `apps/web/src/components/page-header.tsx` | 页面标题、说明和 badge |
| `apps/web/src/components/result-card.tsx` | 估算结果和进度展示卡片 |
| `apps/web/src/components/ui/*.tsx` | shadcn/ui 组件源码，由 CLI 管理 |
| `apps/web/src/pages/test-page.tsx` | 词汇测试页面 |
| `apps/web/src/pages/batch-page.tsx` | CSV 批处理上传页面 |
| `apps/web/src/pages/students-page.tsx` | 测试记录数据库分页页面 |
| `apps/web/src/pages/reports-page.tsx` | 可复现实验输出页面 |

### 6.4 算法包 `packages/estimator`

| 文件 | 作用 |
| --- | --- |
| `packages/estimator/README.md` | 算法包说明 |
| `packages/estimator/src/vocab_estimator/__init__.py` | Python 包导出 |
| `packages/estimator/src/vocab_estimator/adaptive.py` | 保留的自适应逐词测试逻辑 |
| `packages/estimator/src/vocab_estimator/csv_io.py` | 批处理 CSV 读入和状态解析 |
| `packages/estimator/src/vocab_estimator/estimation.py` | rank midpoint + bootstrap 估算核心 |
| `packages/estimator/src/vocab_estimator/models.py` | 算法层数据模型 |
| `packages/estimator/src/vocab_estimator/test_generation.py` | 两阶段测试词生成 |
| `packages/estimator/src/vocab_estimator/text.py` | 文本分词和单词抽取 |
| `packages/estimator/src/vocab_estimator/wordlist.py` | 词表加载和查询 |

### 6.5 实验包 `packages/experiments`

| 文件 | 作用 |
| --- | --- |
| `packages/experiments/README.md` | 实验工具说明 |
| `packages/experiments/src/vocab_experiments/__init__.py` | Python 包标识 |
| `packages/experiments/src/vocab_experiments/batch.py` | CSV 批处理 CLI |
| `packages/experiments/src/vocab_experiments/education_word_rank.py` | 从 ECDICT 生成教育阶段词表 |
| `packages/experiments/src/vocab_experiments/learner_profile.py` | C/F/P/K 四类学员画像估计 |
| `packages/experiments/src/vocab_experiments/report_summary.py` | 稳定性输出汇总和 SVG 图表生成 |
| `packages/experiments/src/vocab_experiments/stability.py` | 900 次稳定性实验 |
| `packages/experiments/src/vocab_experiments/text_estimate.py` | 四类语料文本词汇量估计 |
| `packages/experiments/src/vocab_experiments/word_rank.py` | 旧通用词表生成工具，保留用于对照和测试 |

### 6.6 数据、报告和文档

| 文件 | 作用 |
| --- | --- |
| `data/samples/README.md` | 四类测试语料说明 |
| `data/samples/C.txt` | C 类测试语料 |
| `data/samples/F.txt` | F 类测试语料 |
| `data/samples/P.txt` | P 类测试语料 |
| `data/samples/K.txt` | K 类测试语料 |
| `data/wordlists/word_rank.csv` | ECDICT 教育阶段正式词表 |
| `data/wordlists/evaluation_wordlist.csv` | 稳定性实验验证词表 |
| `data/wordlists/matching_wordlist.csv` | ECDICT 全量文本匹配词库 |
| `reports/outputs/text_estimates.csv` | 四类语料文本估计输出 |
| `reports/outputs/learner_profiles.csv` | 四类学员画像估计输出 |
| `reports/outputs/stability.csv` | 900 次稳定性实验原始输出 |
| `reports/outputs/stability_summary.csv` | 稳定性实验摘要表 |
| `reports/outputs/stability_summary.json` | 稳定性实验摘要 JSON |
| `reports/outputs/stability_chart.svg` | 稳定性实验图表 |
| `docs/adaptive-test-research.md` | 自适应测试方案调研 |
| `docs/course-report.md` | 课程报告草稿 |
| `docs/education-wordlist-research.md` | ECDICT 教育词库调研 |
| `docs/frontend-pages-redesign.md` | 前端多页面重写方案 |
| `docs/technical-architecture-and-flow.md` | 本技术结构说明 |

### 6.7 测试

| 文件 | 作用 |
| --- | --- |
| `tests/test_api_app.py` | FastAPI 路由、数据库分页和实验接口测试 |
| `tests/test_docker_compose_config.py` | Docker Compose 配置检查 |
| `tests/test_estimator_core.py` | 算法、词表、文本和两阶段生成测试 |
| `tests/test_experiments_tools.py` | 实验工具、词库构建和报告输出测试 |
| `tests/test_prepare_server_script.py` | Ubuntu 准备脚本静态检查 |

## 7. 复现命令

```bash
.venv/bin/python -m vocab_experiments.education_word_rank --ecdict ../ref/ECDICT/ecdict.csv --output data/wordlists/word_rank.csv
.venv/bin/python -m vocab_experiments.education_word_rank --ecdict ../ref/ECDICT/ecdict.csv --output data/wordlists/evaluation_wordlist.csv
.venv/bin/python -m vocab_experiments.education_word_rank --ecdict ../ref/ECDICT/ecdict.csv --output data/wordlists/matching_wordlist.csv --matching-only
.venv/bin/python -m vocab_experiments.stability --word-rank data/wordlists/word_rank.csv --evaluation-wordlist data/wordlists/evaluation_wordlist.csv --output reports/outputs/stability.csv --unknown-ratios 0.1,0.2,0.3 --sample-lengths 200,300,400 --repeats 100 --bootstrap-iterations 40
.venv/bin/python -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --matching-wordlist data/wordlists/matching_wordlist.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
.venv/bin/python -m vocab_experiments.learner_profile --word-rank data/wordlists/word_rank.csv --output reports/outputs/learner_profiles.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
.venv/bin/python -m vocab_experiments.report_summary --input reports/outputs/stability.csv --csv reports/outputs/stability_summary.csv --json reports/outputs/stability_summary.json --svg reports/outputs/stability_chart.svg
```

完整验证：

```bash
.venv/bin/python -m pytest -q
pnpm web:test
pnpm web:build
docker compose config --quiet
docker compose -f docker-compose.infra.yml config --quiet
bash -n deploy.sh prepare-server.sh
```
