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
- [x] 设计并生成 `data/wordlists/word_rank.csv`
- [x] 实现词汇量估算核心算法
- [x] 实现 bootstrap 范围和置信度
- [x] 实现 CSV 后台批处理
- [x] 实现批处理和实验 API 入口
- [x] 实现 900 次稳定性实验
- [x] 实现文本语料估计工具
- [ ] 实现四类测试语料估计输出
- [ ] 实现 PostgreSQL + SQLModel + Alembic 数据保存
- [x] 实现 GUI 演示测试流程
- [x] 实现学生测试记录和四六级成绩记录
- [ ] 实现 Docker Compose 和 `deploy.sh`
- [x] 输出报告所需 CSV/JSON/图表
- [ ] 整理课程报告材料

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
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.word_rank --source ../ref/google-10000-english/google-10000-english.txt --output data/wordlists/word_rank.csv --source-name google_10000
```

批处理估算：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.batch --responses input.csv --word-rank data/wordlists/word_rank.csv --output output.csv
```

运行 900 次稳定性实验：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.stability --word-rank data/wordlists/word_rank.csv --output reports/outputs/stability.csv --unknown-ratios 0.1,0.2,0.3 --sample-lengths 200,300,400 --repeats 100
```

生成稳定性实验报告摘要和图表：

```bash
.venv/bin/python -m vocab_experiments.report_summary --input reports/outputs/stability.csv --csv reports/outputs/stability_summary.csv --json reports/outputs/stability_summary.json --svg reports/outputs/stability_chart.svg
```

估计文本语料：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

运行数据库迁移：

```bash
.venv/bin/alembic upgrade head
```

启动后端 API：

```bash
.venv/bin/python -m vocab_api
```

API 批处理上传：

```bash
curl -F "file=@input.csv" http://127.0.0.1:8000/api/batch
```

API 触发稳定性实验：

```bash
curl -X POST http://127.0.0.1:8000/api/experiments/stability \
  -H "Content-Type: application/json" \
  -d '{"output_path":"reports/outputs/stability.csv","unknown_ratios":[0.1,0.2,0.3],"sample_lengths":[200,300,400],"repeats":100}'
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

Docker 相关命令需要 Docker daemon 正在运行；当前可先用 `docker compose config --quiet` 校验配置格式。
