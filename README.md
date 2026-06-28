# vocab-estimator

英语词汇量估算工具课程设计项目。

## 待办事项

- [x] 整理原始课程需求到 `docs/original-requirements.md`
- [x] 建立独立项目目录 `vocab-estimator/`
- [x] 调研高 star 社区参考项目和公开方法
- [x] 写入并更新方案文档 `docs/vocab-estimator-proposal.md`
- [x] 建立中文 agent 协作约定，并要求后续更新同步维护 README 待办事项
- [x] 明确 `vocab-estimator/` 是项目 Git 仓库根目录，提交在项目目录内完成
- [x] 初始化 `vocab-estimator/` Git 仓库并完成项目说明初始提交
- [x] 清理早期测试草稿和缓存文件
- [x] 初始化 monorepo 项目骨架
- [x] 初始化 FastAPI 后端
- [x] 初始化 React + Vite + shadcn/ui 前端
- [x] 使用 shadcn CLI 覆盖安装前端 UI 组件
- [x] 设计并生成 `data/wordlists/word_rank.csv`
- [x] 实现词汇量估算核心算法
- [x] 实现 bootstrap 范围和置信度
- [x] 实现 CSV 后台批处理
- [x] 实现批处理和实验 API 入口
- [x] 实现 900 次稳定性实验
- [x] 实现文本语料估计工具
- [x] 实现四类测试语料估计输出
- [x] 实现 PostgreSQL + SQLModel + Alembic 数据保存
- [x] 实现 GUI 演示测试流程
- [x] 实现学生测试记录和四六级成绩记录
- [x] 实现 Docker Compose 和 `deploy.sh`
- [x] 实现本地开发 Docker infra，只启动 PostgreSQL，并配置根 `package.json` 启动脚本
- [x] Web 服务使用默认 HTTP 80 端口，方便同学直接访问
- [x] 增加 Ubuntu 服务器部署前准备脚本，安装 Docker/Compose 并为 2G 内存配置 swap
- [x] 输出报告所需 CSV/JSON/图表
- [x] 整理课程报告材料
- [x] 移除前端固定 8 个正式测试词
- [x] 实现后端动态分层测试题生成 API
- [x] 保留后端两阶段测试 API，并实现 GUI 自适应逐词测试流程
- [x] 前端词汇测试改为单词逐个出现，避免长列表滚动
- [x] 实现自适应逐词测试 API，支持认识、不认识和不确定
- [x] 补充自适应词汇测试社区方案调研文档
- [x] 强化“不认识”选中态视觉区分
- [x] 移除页面顶部“课程设计工具台”标签
- [x] 修复 Tailwind v4 样式入口，恢复前端工具类编译
- [x] 美化前端首屏实验台，增加网格背景、进度摘要、结果空态和 rank badge
- [x] 前端批处理页改为调用 `/api/batch`
- [x] 前端批处理页改为真实 CSV 文件上传
- [x] 前端批处理页支持拖拽上传 CSV 文件
- [x] 扩展 `word_rank.csv` 到 30000 词
- [x] 增加独立 `evaluation_wordlist.csv`
- [x] 修正 900 次稳定性实验，保留 bootstrap 范围和摘要标准差
- [x] 增加 C/F/P/K learner profile 估计输出
- [x] 增加学生多次测试匿名样例输出
- [x] 增加学生四六级成绩与估计词汇量相关性输出
- [x] 增加 GUI 实验/报告输出查看页
- [x] API Docker 镜像包含样本数据和报告输出
- [x] 更新课程报告草稿以说明新假设和限制
- [x] 新建 `frontend-pages-redesign` 分支重写前端页面结构
- [x] 前端从 Tabs 改为 React Router 多页面路由
- [x] 使用 shadcn Sidebar 和 Breadcrumb 搭建应用布局
- [x] 学生记录和实验输出使用 TanStack Table 分页展示
- [x] 本地 Vite 前端默认端口对齐为 5010
- [x] 写入前端多页面重写技术方案文档
- [x] 移除顶部栏 SidebarTrigger 与面包屑之间的残缺竖向分隔符

## 备注

- 每次完成项目事项后，需要同步勾选或补充本待办事项。
- `ref/` 下仓库仅作为参考，不作为项目源码的一部分。

## 当前可用命令

运行测试：

```bash
.venv/bin/python -m pytest -q
```

重新生成词表：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.word_rank --source ../ref/google-10000-english/google-10000-english.txt --supplement ../ref/english-words/words_alpha.txt --output data/wordlists/word_rank.csv --source-name google_10000 --limit 30000
```

重新生成独立验证词表：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.word_rank --source ../ref/google-10000-english/20k.txt --output data/wordlists/evaluation_wordlist.csv --source-name google_20k_evaluation --limit 20000
```

批处理估算：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.batch --responses input.csv --word-rank data/wordlists/word_rank.csv --output output.csv
```

运行 900 次稳定性实验：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.stability --word-rank data/wordlists/word_rank.csv --evaluation-wordlist data/wordlists/evaluation_wordlist.csv --output reports/outputs/stability.csv --unknown-ratios 0.1,0.2,0.3 --sample-lengths 200,300,400 --repeats 100 --bootstrap-iterations 40
```

生成稳定性实验报告摘要和图表：

```bash
.venv/bin/python -m vocab_experiments.report_summary --input reports/outputs/stability.csv --csv reports/outputs/stability_summary.csv --json reports/outputs/stability_summary.json --svg reports/outputs/stability_chart.svg
```

估计文本语料：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

估计四类学员画像：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.learner_profile --word-rank data/wordlists/word_rank.csv --output reports/outputs/learner_profiles.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

生成学生匿名样例：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.student_samples --raw reports/outputs/student_samples.csv --summary reports/outputs/student_summary.csv --correlation reports/outputs/student_correlation.json
```

课程报告草稿：

```text
docs/course-report.md
```

运行数据库迁移：

```bash
.venv/bin/alembic upgrade head
```

启动后端 API：

```bash
.venv/bin/python -m vocab_api
```

启动本地开发数据库：

```bash
pnpm infra:up
```

需要修改本地端口或数据库连接时，先复制 `.env.example`：

```bash
cp .env.example .env
```

启动本地开发后端（连接 Docker infra PostgreSQL）：

```bash
pnpm api:dev
```

启动本地开发前端：

```bash
pnpm web:dev
```

一键启动本地开发数据库、后端和前端：

```bash
pnpm dev
```

停止本地开发数据库：

```bash
pnpm infra:down
```

API 批处理上传：

```bash
curl -F "file=@input.csv" http://127.0.0.1:8000/api/batch
```

API 触发稳定性实验：

```bash
curl -X POST http://127.0.0.1:8000/api/experiments/stability \
  -H "Content-Type: application/json" \
  -d '{"output_path":"reports/outputs/stability.csv","evaluation_wordlist_path":"data/wordlists/evaluation_wordlist.csv","unknown_ratios":[0.1,0.2,0.3],"sample_lengths":[200,300,400],"repeats":100,"bootstrap_iterations":40}'
```

API 触发文本语料估计：

```bash
curl -X POST http://127.0.0.1:8000/api/experiments/text-estimate \
  -H "Content-Type: application/json" \
  -d '{"text_paths":["data/samples/C.txt","data/samples/F.txt","data/samples/P.txt","data/samples/K.txt"],"output_path":"reports/outputs/text_estimates.csv"}'
```

运行前端测试：

```bash
pnpm web:test
```

构建前端：

```bash
pnpm web:build
```

启动前端：

```bash
pnpm web:dev
```

部署到服务器：

```bash
./deploy.sh
```

Ubuntu 服务器部署前准备（推荐 2 核 2G 服务器先执行）：

```bash
sudo ./prepare-server.sh
```

如果服务器无法访问 Docker Hub，可以指定 Docker registry mirror。腾讯云服务器可先尝试：

```bash
sudo DOCKER_REGISTRY_MIRRORS=https://mirror.ccs.tencentyun.com ./prepare-server.sh
```

2G 内存服务器部署时建议限制 Compose 并发构建：

```bash
COMPOSE_PARALLEL_LIMIT=1 ./deploy.sh
```

部署后访问地址：

```text
http://服务器公网IP/
```

服务器安全组至少放行：

```text
80/tcp   Web 前端页面，给同学访问
22/tcp   SSH，只建议放行自己的 IP
8000/tcp API 接口，可选；只访问页面时不需要公网开放
```

Docker 相关命令需要 Docker daemon 正在运行；当前可先用 `docker compose config --quiet` 校验配置格式。`prepare-server.sh` 如果把当前用户加入了 `docker` 组，需要重新登录后再直接运行 Docker 命令。
