# 英语词汇量估算工具课程设计报告草稿

## 1. 项目概述

本项目实现一个英语词汇量估算工具，覆盖课程要求中的 GUI 演示测试、后台批处理测试、四类测试语料估计、验证方法、简单数据库和部署脚本。

项目采用轻量 monorepo：

- `apps/api`：FastAPI 后端，负责动态出题、估算 API、批处理 API、测试记录保存和实验入口。
- `apps/web`：React + Vite + shadcn/ui 前端，负责课堂 GUI 演示。
- `packages/estimator`：纯 Python 估计算法包。
- `packages/experiments`：词表生成、CSV 批处理、稳定性实验、文本语料估计、学员画像估计和报告摘要工具。
- `data/wordlists`：主词表和验证词表。
- `data/samples`：四类测试语料 `C.txt/F.txt/P.txt/K.txt`。
- `reports/outputs`：可复现实验输出。

## 2. 原始需求对应

| 原始需求 | 项目实现 |
| --- | --- |
| 数据、词汇表 | `data/wordlists/word_rank.csv`，ECDICT 教育阶段词库 14772 词 |
| 词汇量估计算法 | rank midpoint + bootstrap 范围 |
| GUI 演示测试 | 两阶段动态出题测试工作台 |
| 后台批处理测试 | `vocab_experiments.batch` CLI 和 `/api/batch` |
| 四类学员实际估计 | `text_estimates.csv` 与 `learner_profiles.csv` |
| 验证方法 | ECDICT evaluation wordlist 的 900 次稳定性实验 |
| 简单数据库 | SQLModel + Alembic，Docker 部署使用 PostgreSQL |
| 扩展功能 | API 化、Docker Compose 部署、测试记录持久化、报告输出查看 |

## 3. 词表与测试题生成

主词表通过 `skywind3000/ECDICT` 的 `ecdict.csv` 生成，只保留中考、高考、四级、六级、雅思、托福、GRE 相关标签词。当前规模为 14772 个词。生成结果保存在：

```text
data/wordlists/word_rank.csv
```

验证词表同样使用 ECDICT 教育阶段词库，保存在：

```text
data/wordlists/evaluation_wordlist.csv
```

文本匹配词库使用 ECDICT 全量单词，保存在：

```text
data/wordlists/matching_wordlist.csv
```

生成命令：

```bash
.venv/bin/python -m vocab_experiments.education_word_rank --ecdict ../ref/ECDICT/ecdict.csv --output data/wordlists/word_rank.csv
.venv/bin/python -m vocab_experiments.education_word_rank --ecdict ../ref/ECDICT/ecdict.csv --output data/wordlists/evaluation_wordlist.csv
.venv/bin/python -m vocab_experiments.education_word_rank --ecdict ../ref/ECDICT/ecdict.csv --output data/wordlists/matching_wordlist.csv --matching-only
```

词表字段保留 `word,rank,frequency,source` 兼容列，并额外包含 `level,tags,translation,bnc,frq`。排序规则为：先按教育阶段排序（中考、高考、四级、六级、雅思、托福、GRE），同阶段内按 ECDICT 的当代语料词频 `frq`、BNC 词频 `bnc` 和字母序排序。

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

文本难度估计命令。估计 rank 仍来自 ECDICT 教育阶段词库，文本覆盖匹配使用 ECDICT 全量词库：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --matching-wordlist data/wordlists/matching_wordlist.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

当前文本估计摘要：

| 文本 | 估计词汇量 | 范围 | 文本覆盖置信度 | 唯一词数 | 识别词数 | 可估计词数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C.txt | 8366 | 5386-8990 | 0.893 | 509 | 505 | 428 |
| F.txt | 7090 | 3914-8399 | 0.898 | 439 | 438 | 376 |
| P.txt | 4700 | 1711-8152 | 0.894 | 457 | 454 | 382 |
| K.txt | 3299 | 1041-8157 | 0.783 | 190 | 190 | 174 |

其中“识别词数”表示 ECDICT 全量匹配词库能识别的词；“可估计词数”表示能映射到教育阶段 rank 并参与估算的词。这样可以避免把非教育词、专名或变形词全部计入 `ignored_words`，同时不改变正式测试词库的教育阶段定位。

由于文本难度不完全等同于真实学员词汇量，项目另外提供 learner profile 估计。该估计使用原始需求中的层级假设：高等级学员应认识低等级材料中的大部分词，低等级学员可能不认识高等级材料中的部分词。

learner profile 复现命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.learner_profile --word-rank data/wordlists/word_rank.csv --output reports/outputs/learner_profiles.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

当前 learner profile 输出：

| 学员类别 | 估计词汇量 | 范围 | 置信度 | known | unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| C | 13037 | 12527-13037 | 0.865 | 852 | 0 |
| F | 8465 | 8238-9571 | 0.642 | 626 | 143 |
| P | 1812 | 1639-2287 | 0.541 | 403 | 283 |
| K | 384 | 340-384 | 0.713 | 154 | 435 |

## 6. 后台批处理与稳定性验证

CSV 批处理命令：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src .venv/bin/python -m vocab_experiments.batch --responses input.csv --word-rank data/wordlists/word_rank.csv --output output.csv
```

前端批处理页会拖拽或选择上传 CSV 文件到 `/api/batch`，后端会保存 `batch_jobs` 记录。

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

稳定性摘要中，样本长度越大，估计标准差整体越小。例如未知比例 10% 时，样本长度从 200 增加到 400，估计标准差从 334.666 降至 203.774。

## 7. GUI 与测试记录

前端提供课程演示工作台：

- 两阶段 150 词逐词测试。
- 估计结果展示。
- CSV 批处理拖拽或选择上传。
- 测试记录自动保存。
- 实验/报告输出查看。

学生测试记录字段：

- 学号。
- 姓名。
- 四级成绩（选填）。
- 六级成绩（选填）。
- 测试时间。
- 估计词汇量、范围、置信度。

测试记录由真实 GUI 测评流程自动写入数据库，不再使用匿名演示数据。记录页通过后端分页接口查询：

```text
GET /api/student-results?page=1&page_size=5
```

测试流程：

- 用户先填写学号、姓名、可选四级成绩、可选六级成绩。
- 系统生成 150 词两阶段测试题。
- 用户逐词选择“认识 / 不认识”。
- 完成后前端调用 `POST /api/student-results` 保存估计结果和答题明细。
- 测试记录页从数据库分页读取正式测试记录。

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

- Web：`http://服务器IP`
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
curl -fsSI http://127.0.0.1
```

验证覆盖：

- 动态测试题生成。
- 两阶段测试 API。
- 估计算法。
- CSV 批处理。
- ECDICT evaluation wordlist 稳定性实验。
- 文本语料估计。
- learner profile 估计。
- 学生匿名样例输出。
- API 健康检查、估算、批处理、测试记录、实验接口、报告输出接口。
- 前端测试和生产构建。
- Docker Compose 配置、镜像构建、数据库迁移、Web/API/PostgreSQL 启动。

## 10. 成员工作量分配

当前按单人课程设计版本记录：

| 成员 | 工作内容 | 占比 |
| --- | --- | ---: |
| 张少宏 | 总体设计、算法实现、前端演示、后端 API、数据库、实验验证、报告整理 | 100% |

如多人提交，可将该表替换为实际组员分工，所有成员占比总和保持 100%。

## 11. 限制与改进方向

- 当前词表来自 ECDICT 社区词库，考试标签不保证与最新官方大纲逐词完全一致。
- CSV 中的 `frequency` 字段为兼容项目格式，由 ECDICT 的 `frq` 或 `bnc` 顺序换算得到。
- 旧版通用词库生成的历史测试记录不应与新版 ECDICT 教育词库结果直接比较。
- learner profile 是基于课程材料和层级假设的估计，不等同于真实学生测试结果。
- 学生测试记录以数据库中的真实 GUI 测评结果为准，不再提供匿名演示数据。
- 可进一步接入 TestYourVocab 自动化对比数据，计算外部系统误差。
