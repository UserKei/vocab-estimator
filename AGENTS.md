# Agent 协作说明

本目录是 `vocab-estimator` 英语词汇量估算工具课程设计项目的真实项目根目录。

## Git 仓库约定

- 当前目录 `vocab-estimator/` 是项目 Git 仓库根目录。
- 父目录 `/Users/kei/WorkSpace/homework` 只是工作区容器，不作为项目仓库提交。
- 所有项目提交都在本目录完成。
- 从父级工作区执行 Git 命令时，使用：

```bash
git -C vocab-estimator status
git -C vocab-estimator diff
git -C vocab-estimator add <files>
git -C vocab-estimator commit -m "<message>"
```

- 不要提交 `ref/` 参考仓库。
- 不要把父级 `docs/` 仓库内容混入本项目提交，除非用户明确要求迁移。

## 必须同步更新项目清单

每当 agent 对本项目做出推进项目进度或完成项目事项的更新时，必须同时更新：

```text
README.md
```

规则：

- README 中必须保留“待办事项”清单。
- 已完成事项使用 `[x]` 标记。
- 未完成事项使用 `[ ]` 标记。
- 发现新的项目事项时，需要补充到待办清单。
- 只有在相关文件、输出或验证结果确实存在时，才可以勾选完成。
- 最终回复中需要说明仍未勾选或被阻塞的事项。

## 项目上下文

实现功能前，先阅读父级工作区中的相关文档：

- `../docs/original-requirements.md`
- `../docs/vocab-estimator-proposal.md`

当前已确认的技术方向：

- 后端使用 Python FastAPI。
- 前端使用 React + Vite + shadcn/ui。
- 数据库使用 PostgreSQL，Python 侧使用 SQLModel + Alembic。
- 采用轻量 monorepo 结构。
- 使用 Docker Compose 和 `deploy.sh` 支持服务器部署。
- 批处理实验以 CLI 可复现为优先，API 负责触发或读取结果。

## 工程注意事项

- 实现范围要聚焦原始课程需求。
- 除非用户调整范围，否则不要引入登录鉴权、多租户、微服务或复杂后台管理系统。
- 社区项目只作为思路参考，不直接复制实现。
- 算法代码需要与 API、UI 代码保持边界清晰。
- 报告证据优先输出到 `reports/outputs/`，并保持可复现。
- 声称完成前，运行最小但有效的验证，并在回复中说明检查了什么。
