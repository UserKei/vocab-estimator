# 英语词汇量估算工具课程设计报告草稿

## 1. 项目概述

本项目实现一个英语词汇量估算工具，覆盖课程要求中的 GUI 演示测试、后台批处理测试、四类测试语料估计、验证方法、简单数据库和部署脚本。

项目采用轻量 monorepo：

- `apps/api`：FastAPI 后端，负责动态出题、估算 API、批处理 API、学生记录保存和实验入口。
- `apps/web`：React + Vite + shadcn/ui 前端，负责课堂 GUI 演示。
- `packages/estimator`：纯 Python 估计算法包。
- `packages/experiments`：词表生成、CSV 批处理、稳定性实验、文本语料估计、学员画像估计和报告摘要工具。
- `data/wordlists`：主词表和验证词表。
- `data/samples`：四类测试语料 `C.txt/F.txt/P.txt/K.txt`。
- `reports/outputs`：可复现实验输出。

## 2. 原始需求对应

| 原始需求 | 项目实现 |
| --- | --- |
| 数据、词汇表 | `data/wordlists/word_rank.csv`，30000 词 |
| 词汇量估计算法 | rank midpoint + bootstrap 范围 |
| GUI 演示测试 | 两阶段动态出题测试工作台 |
| 后台批处理测试 | `vocab_experiments.batch` CLI 和 `/api/batch` |
| 四类学员实际估计 | `text_estimates.csv` 与 `learner_profiles.csv` |
| 验证方法 | 独立 evaluation wordlist 的 900 次稳定性实验 |
| 简单数据库 | SQLModel + Alembic，Docker 部署使用 PostgreSQL |
| 扩展功能 | API 化、Docker Compose 部署、学生记录持久化、报告输出查看 |

## 3. 词表与测试题生成

主词表通过 `google-10000-english` 基线词表和 `english-words` 补充词表生成，当前规模为 30000 个词。生成结果保存在：

```text
data/wordlists/word_rank.csv
```

独立验证词表保存在：

```text
data/wordlists/evaluation_wordlist.csv
```

GUI 测试不再使用固定单词列表，而是由后端动态生成：

- 第一阶段：从全词表按 rank 分层抽样，粗略覆盖易词、中等词和难词。
- 第二阶段：根据第一阶段回答估计出的水平，在附近 rank 区间加密抽样。
- 最终估算：合并两个阶段的 known/unknown 回答，调用统一 `estimate_vocabulary` 算法。

相关 API：

```text
POST /api/test-sessions
POST /api/test-sessions/{session_id}/next
POST /api/test-sessions/{session_id}/estimate
```

## 4. 算法设计

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

## 5. 四类测试语料估计结果

四类测试语料来源为工作区 `docs/demo/`，已复制到项目内 `data/samples/` 以便独立复现。

文本难度估计命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

当前文本估计摘要：

| 文本 | 估计词汇量 | 范围 | 置信度 | 唯一词数 | 匹配词数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| C.txt | 6705 | 4425-8423 | 0.686 | 509 | 388 |
| F.txt | 7073 | 4033-8422 | 0.748 | 439 | 365 |
| P.txt | 5362 | 2350-7080 | 0.802 | 457 | 407 |
| K.txt | 3782 | 1714-5876 | 0.750 | 190 | 178 |

由于文本难度不完全等同于真实学员词汇量，项目另外提供 learner profile 估计。该估计使用原始需求中的层级假设：高等级学员应认识低等级材料中的大部分词，低等级学员可能不认识高等级材料中的部分词。

learner profile 复现命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.learner_profile --word-rank data/wordlists/word_rank.csv --output reports/outputs/learner_profiles.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

当前 learner profile 输出：

| 学员类别 | 估计词汇量 | 范围 | 置信度 | known | unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| C | 29086 | 19709-29086 | 0.610 | 1054 | 0 |
| F | 16474 | 9443-19709 | 0.357 | 793 | 167 |
| P | 2054 | 1750-2252 | 0.548 | 506 | 344 |
| K | 859 | 839-913 | 0.756 | 178 | 541 |

## 6. 后台批处理与稳定性验证

CSV 批处理命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.batch --responses input.csv --word-rank data/wordlists/word_rank.csv --output output.csv
```

前端批处理页会将 CSV 上传到 `/api/batch`，后端会保存 `batch_jobs` 记录。

稳定性实验按照课程建议设置：

- 未知比例：`0.1, 0.2, 0.3`
- 样本长度：`200, 300, 400`
- 每组重复：`100`
- 总次数：`3 * 3 * 100 = 900`
- 验证词表：`data/wordlists/evaluation_wordlist.csv`

复现命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.stability --word-rank data/wordlists/word_rank.csv --evaluation-wordlist data/wordlists/evaluation_wordlist.csv --output reports/outputs/stability.csv --unknown-ratios 0.1,0.2,0.3 --sample-lengths 200,300,400 --repeats 100 --bootstrap-iterations 40
```

报告摘要生成命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.report_summary --input reports/outputs/stability.csv --csv reports/outputs/stability_summary.csv --json reports/outputs/stability_summary.json --svg reports/outputs/stability_chart.svg
```

输出材料：

- `reports/outputs/stability.csv`
- `reports/outputs/stability_summary.csv`
- `reports/outputs/stability_summary.json`
- `reports/outputs/stability_chart.svg`

## 7. GUI 与学生记录

前端提供课程演示工作台：

- 两阶段词汇测试。
- 估计结果展示。
- CSV 批处理上传。
- 学生记录保存。
- 实验/报告输出查看。

学生测试记录字段：

- 姓名或代号。
- 四级成绩。
- 六级成绩。
- 测试时间。
- 估计词汇量、范围、置信度。

当前提供匿名演示数据，用于报告展示每人 3 次测试结果：

```text
reports/outputs/student_samples.csv
reports/outputs/student_summary.csv
reports/outputs/student_correlation.json
```

生成命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.student_samples --raw reports/outputs/student_samples.csv --summary reports/outputs/student_summary.csv --correlation reports/outputs/student_correlation.json
```

当前学生样例摘要：

| 代号 | 四级 | 六级 | 次数 | 平均词汇量 | 标准差 |
| --- | ---: | ---: | ---: | ---: | ---: |
| S001 | 430 | 0 | 3 | 3750.000 | 96.264 |
| S002 | 498 | 420 | 3 | 5263.333 | 86.538 |
| S003 | 561 | 512 | 3 | 6536.667 | 107.806 |
| S004 | 612 | 548 | 3 | 7573.333 | 87.305 |

当前匿名样例的简单相关性输出：

| 指标 | 值 |
| --- | ---: |
| 四级成绩与平均估计词汇量相关性 | 1.000 |
| 六级成绩与平均估计词汇量相关性 | 0.982 |

这些数据为匿名演示数据；实际提交时可替换为真实同学测试记录。

## 8. 部署说明

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

## 9. 验证记录

已执行的验证命令：

```bash
.venv/bin/python -m pytest -q
pnpm web:test
pnpm web:build
docker compose config --quiet
./deploy.sh
curl -fsS http://127.0.0.1:8000/api/health
curl -fsSI http://127.0.0.1:8080
```

验证覆盖：

- 动态测试题生成。
- 两阶段测试 API。
- 估计算法。
- CSV 批处理。
- 独立 evaluation wordlist 稳定性实验。
- 文本语料估计。
- learner profile 估计。
- 学生匿名样例输出。
- API 健康检查、估算、批处理、学生记录、实验接口、报告输出接口。
- 前端测试和生产构建。
- Docker Compose 配置、镜像构建、数据库迁移、Web/API/PostgreSQL 启动。

## 10. 成员工作量分配

当前按单人课程设计版本记录：

| 成员 | 工作内容 | 占比 |
| --- | --- | ---: |
| 张少宏 | 总体设计、算法实现、前端演示、后端 API、数据库、实验验证、报告整理 | 100% |

如多人提交，可将该表替换为实际组员分工，所有成员占比总和保持 100%。

## 11. 限制与改进方向

- 当前词表频率字段为 rank 派生近似值，不是完整语料频率统计。
- learner profile 是基于课程材料和层级假设的估计，不等同于真实学生测试结果。
- 学生测试记录当前包含匿名演示数据，真实提交时可替换为实际同学数据。
- 可进一步接入 TestYourVocab 自动化对比数据，计算外部系统误差。
