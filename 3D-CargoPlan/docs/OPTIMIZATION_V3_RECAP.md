<!-- #created 11/08/2026 -->
# v3 装柜优化计算复盘

生成时间：2026-10-18T07:56:41.963Z。本页由 [src/scripts/summarize-v3-optimization.ts](../src/scripts/summarize-v3-optimization.ts) 从候选文件重新校验生成；完整输入、解、SHA、逐 ID 缺件和排除原因见 [data/optimization/v3-progress.json](../data/optimization/v3-progress.json)。

**完整合法候选最少仍为 11 柜（1371/1371 件）；是否优于原基准另按尾柜及前十柜瓶颈指标判定。**

当前完整方案：[data/optimization/v3-r2-delivery/current-best.json](../data/optimization/v3-r2-delivery/current-best.json)，SHA256 `fa4fa9261fdcc0c7e1a852eb3455299f2e268695d9690a379e950058c68014d5`。前10柜最低材料利用率 **66.218462%**，较原PDF提高 **2.698233 个百分点**；排序后尾柜 **35.581997 m³**。尾柜也小于原方案重编号不变量，达到完整11柜缩尾改进。

历史未完成分支最高：1370/1371 件，缺 1 件。部分候选的尾柜指标不作验收结论。结果：[data/optimization/v3-four-long-zones-w12-repair/best-partial.json](../data/optimization/v3-four-long-zones-w12-repair/best-partial.json)，SHA256 `5b50815f4e8d9026a64b6d35ac73d28b24a938dfe00940395eab78ad71812b63`。

## 原题与验收口径

冻结合同：[data/reconstruction/model-v3-contract.json](../data/reconstruction/model-v3-contract.json)，SHA256 `4765ae81a6b1b295bc0dea12293c96781cb7894f993957f2b77c4abd36c2b4c8`。1371 件总重 134777.37 kg，装载模型实体体积 495.748311 m³（外包盒扣已确认空腔；不是铝材/玻璃净材料体积）。

原 PDF 标号第 11 柜材料体积 **41.549138 m³**；对原 11 柜任意重编号后的最小尾柜仍为 **39.312163 m³**，前十柜最低材料利用率 **63.520229%**。仅改编号不算优化。用户接受完整 11 柜下减小尾柜、提高前十柜瓶颈；10 柜是更好的可能结果，非唯一成功条件。

- 完整原始身份账：1371 件，原包装尺寸、重量、源行约束不变；单柜合同总重上限 28000 kg。
- 净空 11600×2250×2500 mm；仅原源行 16 的 W02 框保留高 2560 mm 的指定例外。
- 三轴留缝：玻璃架之间 0 mm，其余 5 mm。
- 保留源表允许朝向；孔内框扇严格原宽轴竖直，不增加窗面内 90° 旋转。
- 居中空腔：W02 侧放孔 1200×160×2200 mm；W01 长框按原轴 3000×790×210 mm；短框 1200×1600×110 mm。仅允许的源类别可完整嵌入单个获准孔。
- 保留同源/可叠放对象、顶部可放、禁止错位、必须落地、累计载荷、顶部单件重量和叠放件数等所有原表约束。
- 玻璃架顶部累计载荷不超过 600 kg；W07/W11/W12 顶部单件不超过 5 kg；W02/W06 扇侧放顶部累计严格小于 120 kg；源表平放至多 10 件等限制不变。
- 32 件指定辅材上方货物必须最大面积面朝下；其中源行 28/29 重箱顶部混放单件不超过 60 kg、累计不超过 200 kg。
- 仅取消程序额外的 80% 底面承托比例；仍需正的实体承托投影、重心投影位于实体接触点凸包内，并逐层计载荷。
- 禁止错位按物品自身约束执行（item-only）；此项源字段校准自 v2 保留，未新增下方物品对上件的双向额外限制。
- 竖直 5 mm 使用 pdf-clearance-projection 明示投影传载假设；没有虚构实体隔垫。验证范围为几何与载荷假设，不能替代现场力学验收。

## 固定配货复现与全局重排分开记账

固定原配货功能复现记录仍为 **5/11 柜**（原柜号 1、2、3、10、11）。这是同一合同下重新构造坐标的工程复现；PDF 仅有栅格图，没有恢复隐藏的原始 XYZ，也没有声称原 11 柜逐项复现完成。其后跨柜优化依据用户“比原 11 柜更优”的授权继续，不能倒推为复现通过。

## 关键计算节点

以下为不同分支里程碑，不是每一步都沿用上一步；耗时是文件记录的本次过程，不能相加成总工作时长。每一行均重新调用公共评估器验证。

| 柜数 | 装入 / 1371 | 缺件 | 方法 | 文件记录秒 | 候选与源 SHA256 |
|---:|---:|---:|---|---:|---|
| 12 | 1371 | 0 | 完整12柜历史基底：1371全量合法，尚不优于原11柜 | 0.346 | [data/optimization/v3/best-complete.json](../data/optimization/v3/best-complete.json)<br>`320791564717ac01ddea1043554db4f8f81b9bc9068403b1f5616a5533e0a44a` |
| 11 | 1323 | 48 | 全玻璃架固定基底，取出小件及依赖闭包后跨柜修补 | 22.235 | [data/optimization/v3-repair-11/candidate-1.json](../data/optimization/v3-repair-11/candidate-1.json)<br>`c359a75d1d58fd2faaef6380e96c2263a195ac6c1b203f3c10968aa0ca7133cc` |
| 11 | 1337 | 34 | 同源货物混合朝向与联合承托宏重排 | 19.496 | [data/optimization/v3-macro-repack/candidate-0.json](../data/optimization/v3-macro-repack/candidate-0.json)<br>`4f5bc3bade9d19fb796912ffb5d93befdcd0cbc21d8eff019da6f0616e194065` |
| 11 | 1341 | 30 | 恢复长细条并合并合法屋顶交换 | 0.622 | [data/optimization/v3-profile-restore/best-partial.json](../data/optimization/v3-profile-restore/best-partial.json)<br>`6b8ab7f854ab9588562b16c0b9939f738139c0a8ac2e466cb2ea460a78629d61` |
| 11 | 1349 | 22 | CP-SAT：同柜支承组件平移，新增 8 件 | 37.503 | [data/optimization/v3-cpsat-floor/result.json](../data/optimization/v3-cpsat-floor/result.json)<br>`be137d8de185784a5b6964e19f4b340bfecb3a58fdeb84f0889c4f5187f2b783` |
| 11 | 1354 | 17 | CP-SAT：替代分堆与承托组件平移，新增 5 件 | 60.241 | [data/optimization/v3-cpsat-floor/round-2/result.json](../data/optimization/v3-cpsat-floor/round-2/result.json)<br>`62d04028715e014ad23f9a6a024115cf0fcd497b2a166ee102255b50bdc6f0e1` |
| 11 | 1359 | 12 | 玻璃架屋顶转载、混合堆及剩余载荷补 W08 | 5.482 | [data/optimization/v3-roof-balance/result.json](../data/optimization/v3-roof-balance/result.json)<br>`f35585eb25d2cb349898e77d78d7cc85b81b50248fc746f9ecaaf9ff37c7c27f` |
| 11 | 1360 | 11 | 225 mm 屋顶条带加装 W08；先移出碰撞地板件 | 0.316 | [data/optimization/v3-roof-stripes/result.json](../data/optimization/v3-roof-stripes/result.json)<br>`3677eb1f2a4167fd366f0873cdfd72d021c0c3913865ebed3f0c839d963c441e` |
| 11 | 1361 | 10 | 按祖先方案合并屋顶条带与 W07 插入，并重新全量验证 | 0.727 | [data/optimization/v3-combined/roof-stripes-merged.json](../data/optimization/v3-combined/roof-stripes-merged.json)<br>`172c61de822892190509454b8dc59f31fce9ac1333c66220adc529d7cd86fe23` |
| 11 | 1365 | 6 | 地板 W02 扇改合法立放、缩小占地后跨柜修补 | 6.676 | [data/optimization/v3-floor-orientation-repair-high/best-partial.json](../data/optimization/v3-floor-orientation-repair-high/best-partial.json)<br>`765f7b0dc84dc990303ae0430439608b410ca1ebda859fae725440cc656d7b79` |
| 11 | 1370 | 1 | 本次重算发现的最新合法部分候选 | 25.978 | [data/optimization/v3-four-long-zones-w12-repair/best-partial.json](../data/optimization/v3-four-long-zones-w12-repair/best-partial.json)<br>`5b50815f4e8d9026a64b6d35ac73d28b24a938dfe00940395eab78ad71812b63` |
| 11 | 1371 | 0 | 首次完整11柜闭合：尾42.138805m³、前10瓶颈65.147198%，当时未实现缩尾 | 8.626 | [data/optimization/v3-last-w12-repair/best-complete.json](../data/optimization/v3-last-w12-repair/best-complete.json)<br>`ff977e2cc4e057ce3c8331648c8af0de5c3b321a868fb76760657fa40d20e6a9` |
| 11 | 1371 | 0 | 上轮完整11柜缩尾交付：尾36.716754m³、前10瓶颈65.147198%；本轮以此继续 | 32.102 | [data/optimization/v3-tail-independent/frozen-complete.json](../data/optimization/v3-tail-independent/frozen-complete.json)<br>`0a274506802290cf613caac102454d81a90ca458beb6e6088986e118d148f897` |
| 11 | 1371 | 0 | 完整11柜缩尾最终候选：与首次全量闭合分别记账，逐项重新验证 | 0.531 | [data/optimization/v3-r2-delivery/current-best.json](../data/optimization/v3-r2-delivery/current-best.json)<br>`fa4fa9261fdcc0c7e1a852eb3455299f2e268695d9690a379e950058c68014d5` |

## 长件优先独立分支

此分支将 46 件 W07 与 92 件 W02 框共 138 件长件设为必装，95 件孔内 W05 随框保持相对姿态；允许独立短窗暂缺，以探索另一种可回填几何。全部长件齐全是诊断指标，部分候选不能作为完整交付，也不能因它替换装入总数更高的旧候选。

| 分支 | 装入 / 缺件 | 长件齐数 | 公共重算合法 | 状态 / 文件记录秒 | 源 SHA256 |
|---|---:|---:|---|---|---|
| [data/optimization/v3-long-first-cpsat/summary.json](../data/optimization/v3-long-first-cpsat/summary.json) | — / — | — / 138 | 没有合法候选 | no-feasible-solver-answer / 111.054 | `1304cb13e8ff89add0576e40ab6b461c32d182fed51c1fdfe914bdf9491ef787` |
| [data/optimization/v3-long-first-cpsat/round-2/result.json](../data/optimization/v3-long-first-cpsat/round-2/result.json) | 1225 / 146 | 138 / 138 | 是 | FEASIBLE / 93.523 | `ce2f8099cbe61a410d6bfbda54b762070c01ea31522f6d18775d4126fb7ff1c4` |
| [data/optimization/v3-long-first-cpsat/hybrid-seed/result.json](../data/optimization/v3-long-first-cpsat/hybrid-seed/result.json) | 1358 / 13 | 138 / 138 | 是 | constructive-candidate / 0.470 | `7408f19abee34b57e065eec7c351d1f030cd5d118f604f8747697208548d1a5e` |
| [data/optimization/v3-long-first-cpsat/round-3/result.json](../data/optimization/v3-long-first-cpsat/round-3/result.json) | 1359 / 12 | 138 / 138 | 是 | FEASIBLE / 93.586 | `1485c559feda0e4ba77a2fcc9233fd91320c365148331c81af5bc35051911485` |

## 历史部分分支缺件（完整当前方案已无缺件）

| 原始 ID | 名称 | 源表/行 |
|---|---|---|
| 门窗:W12:r15:u21 | W12 框+扇 | 门窗:15 |

## 求解状态与复盘限制

- 启发式失败、限时未找到、CP-SAT UNKNOWN/FEASIBLE 均不等于全局无解；局部模型的 OPTIMAL 只证明该冻结组件和姿态模型。当前没有全局最优证明。
- CP-SAT 使用支承/嵌套连通组件、0.5 mm 网格及组件间保守分离；部分轮固定同柜，部分轮允许同规格 W07 跨柜。屋顶转载、源允许朝向变化属于单独构造分支，最终统一经过公共校验器。
- 每个候选源文件 SHA 均以实际读取字节计算。合同或 config 不符、身份账不全、公共校验拒绝的记录列入 JSON 排除清单，不参与最优选择。
- 历史声明的语义输入 hash 若与当前规范化 hash 不同，单独列警示；不替换冻结 manifest 字节，也不跳过权威原始身份与物理约束校验。
- 仅在当前源码 SHA 与历史记录一致时保存源码快照；已经变化的历史源码明确标记“未匹配”，不编造复原。已有各轮实际执行快照和 model gzip 仍原位保留。

本次评估 181 个同合同解文档，其中完整可验收 77 个、合法部分候选 98 个。汇总本身耗时 21.555 秒；其他求解器运行中时需重跑刷新。

```sh
node --import tsx src/scripts/summarize-v3-optimization.ts
```
