# 英语词汇量估算工具课程设计报告草稿

## 1. 项目概述

本项目实现一个英语词汇量估算工具，覆盖课程要求中的 GUI 演示测试、后台批处理测试、四类测试语料估计、验证方法、简单数据库和部署脚本。

项目采用轻量 monorepo：

- `apps/api`：FastAPI 后端，负责估算 API、批处理 API、学生记录保存和实验入口。
- `apps/web`：React + Vite + shadcn/ui 前端，负责课堂 GUI 演示。
- `packages/estimator`：纯 Python 估计算法包。
- `packages/experiments`：词表生成、CSV 批处理、稳定性实验、文本语料估计和报告摘要工具。
- `data/wordlists`：词表 rank 数据。
- `data/samples`：四类测试语料 `C.txt/F.txt/P.txt/K.txt`。
- `reports/outputs`：可复现实验输出。

## 2. 原始需求对应

| 原始需求 | 项目实现 |
| --- | --- |
| 数据、词汇表 | `data/wordlists/word_rank.csv` |
| 词汇量估计算法 | `packages/estimator` 中的 rank midpoint + bootstrap 范围 |
| GUI 演示测试 | `apps/web` 前端测试工作台 |
| 后台批处理测试 | `vocab_experiments.batch` CLI 和 `/api/batch` |
| 四类学员实际估计 | `reports/outputs/text_estimates.csv` |
| 验证方法 | 900 次稳定性实验与摘要图表 |
| 简单数据库 | SQLModel + Alembic，Docker 部署使用 PostgreSQL |
| 扩展功能 | API 化、Docker Compose 部署、学生记录持久化 |

## 3. 算法设计

算法输入为一组单词和用户是否认识：

```csv
word,status
apple,known
exemplify,unknown
```

处理流程：

1. 归一化单词：小写、去除非英文字符。
2. 从 `word_rank.csv` 查询每个单词的 rank。
3. 忽略词表中不存在的单词，并在结果中保留 `ignored_words`。
4. 根据 known / unknown 的 rank 分布计算估计边界。
5. 使用 rank midpoint 得到估计词汇量。
6. 使用 bootstrap 或重复抽样得到估计范围和置信度。

统一输出字段：

- `estimate`：估计词汇量。
- `range_low` / `range_high`：估计范围。
- `confidence`：置信度。
- `method`：算法版本。
- `sample_size`：有效样本数量。
- `ignored_words`：未纳入词表的单词。

## 4. 四类测试语料估计结果

四类测试语料来源为工作区 `docs/demo/`，已复制到项目内 `data/samples/` 以便独立复现。

复现命令：

```bash
.venv/bin/python -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

当前输出摘要：

| 文本 | 估计词汇量 | 范围 | 置信度 | 唯一词数 | 匹配词数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| C.txt | 6472 | 4173-7626 | 0.675 | 509 | 382 |
| F.txt | 6437 | 3943-8110 | 0.738 | 439 | 360 |
| P.txt | 5353 | 2350-7068 | 0.800 | 457 | 406 |
| K.txt | 3782 | 1714-5876 | 0.750 | 190 | 178 |

结果满足原始材料给出的难度关系：`C.txt > F.txt > P.txt > K.txt`。

## 5. 后台批处理与稳定性验证

CSV 批处理命令：

```bash
.venv/bin/python -m vocab_experiments.batch --responses input.csv --word-rank data/wordlists/word_rank.csv --output output.csv
```

稳定性实验按照课程建议设置：

- 未知比例：`0.1, 0.2, 0.3`
- 样本长度：`200, 300, 400`
- 每组重复：`100`
- 总次数：`3 * 3 * 100 = 900`

复现命令：

```bash
.venv/bin/python -m vocab_experiments.stability --word-rank data/wordlists/word_rank.csv --output reports/outputs/stability.csv --unknown-ratios 0.1,0.2,0.3 --sample-lengths 200,300,400 --repeats 100
```

报告摘要生成命令：

```bash
.venv/bin/python -m vocab_experiments.report_summary --input reports/outputs/stability.csv --csv reports/outputs/stability_summary.csv --json reports/outputs/stability_summary.json --svg reports/outputs/stability_chart.svg
```

输出材料：

- `reports/outputs/stability.csv`
- `reports/outputs/stability_summary.csv`
- `reports/outputs/stability_summary.json`
- `reports/outputs/stability_chart.svg`

## 6. GUI 与学生记录

前端提供课程演示工作台：

- 词汇测试。
- 估计结果展示。
- 批处理入口。
- 学生记录展示。

学生测试记录字段：

- 姓名或代号。
- 四级成绩。
- 六级成绩。
- 测试时间。
- 估计词汇量、范围、置信度。

后端通过 SQLModel 保存学生记录和批处理任务，Alembic 管理数据库迁移。

## 7. 部署说明

Docker Compose 包含三个服务：

- `postgres`：PostgreSQL 16。
- `api`：FastAPI 后端。
- `web`：前端静态站点。

部署命令：

```bash
./deploy.sh
```

部署后访问：

- Web：`http://服务器IP:8080`
- API 健康检查：`http://服务器IP:8000/api/health`

## 8. 验证记录

已执行的验证命令：

```bash
.venv/bin/python -m pytest -q
pnpm web:test
pnpm web:build
docker compose config --quiet
env VOCAB_DATABASE_URL=sqlite:////private/tmp/vocab_estimator_goal_alembic.db .venv/bin/alembic upgrade head
./deploy.sh
curl -fsS http://127.0.0.1:8000/api/health
curl -fsSI http://127.0.0.1:8080
```

验证覆盖：

- 估计算法。
- CSV 批处理。
- 稳定性实验。
- 文本语料估计。
- API 健康检查、估算、批处理、学生记录、实验接口。
- 前端测试和生产构建。
- Docker Compose 配置格式。
- Alembic 迁移。
- Docker Compose 完整部署，包含 PostgreSQL、API 和 Web。
- API health 返回 `{"status":"ok"}`，Web 首页返回 HTTP 200。

## 9. 成员工作量分配

当前按单人课程设计版本记录：

| 成员 | 工作内容 | 占比 |
| --- | --- | ---: |
| 张少宏 | 总体设计、算法实现、前端演示、后端 API、数据库、实验验证、报告整理 | 100% |

如多人提交，可将该表替换为实际组员分工，所有成员占比总和保持 100%。

## 10. 可改进方向

- 接入真实 TestYourVocab 自动化对比数据，计算外部系统误差。
- 扩充词表来源，融合更大规模词频数据。
- 将稳定性实验图表扩展为更完整的可视化报告。
- 增加更多真实学生测试记录，进一步分析四六级成绩和估计词汇量的相关性。
