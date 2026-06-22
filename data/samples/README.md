# 四类测试语料

本目录保存课程给出的四类测试语料，来源为工作区父级的 `docs/demo/`：

- `C.txt`
- `F.txt`
- `P.txt`
- `K.txt`

运行以下命令可复现四类语料词汇量估计输出：

```bash
PYTHONPATH=packages/estimator/src:packages/experiments/src python3 -m vocab_experiments.text_estimate --word-rank data/wordlists/word_rank.csv --output reports/outputs/text_estimates.csv data/samples/C.txt data/samples/F.txt data/samples/P.txt data/samples/K.txt
```

当前输出文件：

- `reports/outputs/text_estimates.csv`
