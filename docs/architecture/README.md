# AXTP 架构说明

`docs/architecture/` 存放跨语言通用的架构指导。这里不写某一种 runtime 的 API 设计、代码风格或构建方式，只解释所有语言实现都需要遵守的边界和设计原则。

语言专属 runtime API、目录结构、transport adapter 和编码细节，应放到对应 runtime 仓库。

## 文档

| 文档 | 说明 |
|---|---|
| [domain-feature-classification.md](domain-feature-classification.md) | AXTP domain / feature 分类规则，说明 room、device、system、signage、cast、software、firmware 等边界和 legacy 迁移判断方法。 |
| [protocol-lifecycle-boundaries.md](protocol-lifecycle-boundaries.md) | AXTP 协议生命周期、链路上下文、业务 session、payload encoding、registry/generated/conformance 的边界。 |
