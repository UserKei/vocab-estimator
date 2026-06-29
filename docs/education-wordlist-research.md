# ECDICT 教育阶段词库调研

## 目标

当前项目早期词库来自 `google-10000-english` 和 `english-words`，适合做通用英文词频基线，但会混入缩写、专名、技术词和偏僻词。课程设计的测试对象主要是中国大陆学生，因此词库需要更贴近中考、高考、四六级、雅思、托福和 GRE 这条学习路径。

## 社区方案

### ECDICT

- 仓库：<https://github.com/skywind3000/ECDICT>
- star：约 7.9k
- 许可：MIT
- 数据文件：`ecdict.csv`
- 关键字段：
  - `word`：词条。
  - `translation`：中文释义。
  - `tag`：考试和词汇标签，包含 `zk`、`gk`、`cet4`、`cet6`、`ielts`、`toefl`、`gre` 等。
  - `bnc`：英国国家语料库词频顺序。
  - `frq`：当代语料库词频顺序。

ECDICT 的 README 明确说明数据按考试大纲和语料库词频标注，字段也正好覆盖项目需要的“教育阶段 + 频率排序 + 中文释义”。因此项目采用 ECDICT 作为唯一实际词库来源。

### qwerty-learner

- 仓库：<https://github.com/RealKai42/qwerty-learner>
- star：约 22.4k
- 定位：背单词应用。
- 数据：`public/dicts` 中包含多种词书 JSON。

qwerty-learner 的词书分类很丰富，但它的核心定位是应用项目，不是独立词库数据仓库。为了让课程报告的数据来源更清楚，本项目不从 qwerty-learner 生成正式词库。

## 最终方案

项目新增 `vocab_experiments.education_word_rank`：

- 读取 `../ref/ECDICT/ecdict.csv`。
- 只保留 `zk`、`gk`、`cet4`、`cet6`、`ielts`、`toefl`、`gre` 标签词。
- 阶段顺序固定为：中考、 高考、四级、六级、雅思、托福、GRE。
- 同阶段内部按 `frq`、`bnc`、字母序稳定排序。
- 输出 `word,rank,frequency,source,level,tags,translation,bnc,frq`。
- 额外支持 `--matching-only`，从 ECDICT 全量词条生成文本匹配词库。它只用于四类语料文本覆盖识别，不作为 GUI 测试出题或正式词汇量 rank 来源。

当前生成结果：

- `data/wordlists/word_rank.csv`：14772 词。
- `data/wordlists/evaluation_wordlist.csv`：14772 词。
- `data/wordlists/matching_wordlist.csv`：365948 词。

## 限制

- ECDICT 的考试标签来自社区整理，不保证与最新官方大纲逐词完全一致。
- 输出中的 `frequency` 是为了兼容项目原有 CSV 格式，由 `frq` 或 `bnc` 顺序换算得到。
- 旧版通用词库生成的历史测试记录不应与新版 ECDICT 教育词库结果直接横向比较。
