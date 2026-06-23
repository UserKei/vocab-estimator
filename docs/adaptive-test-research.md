# 自适应词汇测试方案调研

## 调研结论

本项目将词汇测试页从“分页词表批量标记”调整为“单词逐个出现 + 认识/不认识/不确定 + 动态调整难度”的自适应测试流程。

这个方向更符合公开词汇量测试和计算机化自适应测试的常见做法：

- TestYourVocab / Preply 的公开说明采用两步测试：先用覆盖难易范围的词获得粗略估计，再围绕估计区间进行更细的测试；其核心依据是词频 rank 和 midpoint 思路。
- Computerized Adaptive Testing（CAT）的通用思想是根据用户上一题表现更新能力估计，并选择下一道更合适的题目。
- 课程设计原始需求要求“测试语料估计词汇量水平（范围 + 置信度）”和“GUI 演示测试”，并没有要求必须一次展示固定词表。因此逐词自适应交互更自然，也更容易让同学实际完成测试。

参考链接：

- Preply / TestYourVocab 方法说明：https://preply.com/en/learn/english/test-your-vocab/how-it-works
- Computerized adaptive testing 概念：https://en.wikipedia.org/wiki/Computerized_adaptive_testing
- BOBCAT 论文方向（自适应词汇测试研究）：https://arxiv.org/abs/2108.12731

## 本项目采用的轻量方案

项目不引入完整 IRT 标定模型，原因是课程设计没有题库标定数据，也不需要复杂考试系统。当前实现采用 rank-based adaptive cutoff：

- 词频 rank 越小，词越常见，题目越容易。
- 用户选择“认识”后，下一题向更高 rank 移动，即更难。
- 用户选择“不认识”后，下一题向更低 rank 移动，即更容易。
- 用户选择“不确定”后，下一题只做小幅移动，并降低最终置信度。
- 当样本达到上限，或估计区间已经较窄时结束测试。
- 输出词汇量估计值、范围、置信度、样本量和忽略词。

## 与原始需求的对应关系

- “设计一至多种用户词汇量估算算法”：当前保留 rank midpoint + bootstrap，同时新增自适应 rank cutoff。
- “GUI 演示测试”：前端改为每次只显示一个单词，操作更接近实际在线词汇测试。
- “后台批处理测试”：CSV 上传批处理保持不变，用于批量验证。
- “给出词汇量估计范围 + 置信度”：自适应结果同样输出范围与置信度。
- “找不同学生每个人测试 3-5 次”：逐词测试更适合真实同学完成，结果仍可保存到学生记录。

## 当前实现位置

- 算法：`packages/estimator/src/vocab_estimator/adaptive.py`
- API：`POST /api/adaptive-test-sessions` 与 `POST /api/adaptive-test-sessions/{session_id}/answer`
- 前端：`apps/web/src/App.tsx`
- 测试：`tests/test_estimator_core.py`、`tests/test_api_app.py`、`apps/web/src/App.test.tsx`
