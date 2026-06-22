# 测试语料放置说明

课程给出的 `测试语料.rar` 解压后，将四类文本放到本目录：

- `C.txt`
- `F.txt`
- `P.txt`
- `K.txt`

放入文件后可运行：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```
