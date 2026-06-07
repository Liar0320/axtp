# AXTP Legacy 迁移

`docs/legacy-migration/` 集中保存旧协议证据、分类输出、迁移计划和 generated 迁移候选。这里是迁移工作区，不是 AXTP 当前协议事实源。

稳定 AXTP 事实仍来自：

```text
registry/**/*.yaml + registry/domains/**/*.yaml
  -> protocol/axtp.protocol.yaml
  -> docs/generated/**
```

## 目录结构

| 路径 | 用途 |
|---|---|
| `evidence/` | AXDP、VM33、Rooms、NearHub 等旧协议原始证据。 |
| `classification/` | 脚本生成的 domain-feature 分类输入。 |
| `plans/` | 人工迁移计划和评审矩阵。 |
| `generated/` | 生成的迁移候选和 adapter 规划输出。 |
| `planning/` | 仍对 legacy compatibility 有价值的历史规划参考。 |

不要在没有具体旧命令、状态码、payload 或行为证据以及人工评审的情况下，把 legacy mapping 提升到 `registry/`。
