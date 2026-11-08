<!-- #created 11/08/2026 -->
# 原 PDF 固定 11 柜复现进度

审计时间：2026-10-18T02:01:53.914Z。模型合同：`data/reconstruction/model-v3-contract.json`。

**完整通过 5/11 柜；当前各柜最好合法候选合计放入 1308/1371 件，仍缺 63 件。** 部分候选校验通过只表示已装子集合法，不构成完整方案。固定配货复现尚未全部通过；已按单独工作流记录转入全局跨柜重排研究。全局最优尚未证明。

| 原柜号 | 放入 / 原配货 | 未装 | 状态 | 可复查结果 |
| --- | ---: | ---: | --- | --- |
| 1 | 164 / 164 | 0 | 完整通过 | [坐标与尝试来源](../../data/reconstruction/v3/container-1/result.json) |
| 2 | 124 / 124 | 0 | 完整通过 | [坐标与尝试来源](../../data/reconstruction/v3/container-2/result.json) |
| 3 | 180 / 180 | 0 | 完整通过 | [坐标与尝试来源](../../data/reconstruction/v3/container-3/result.json) |
| 4 | 154 / 163 | 9 | 未完成 | [坐标与尝试来源](../../data/reconstruction/v3/container-4/result.json) |
| 5 | 89 / 100 | 11 | 未完成 | [坐标与尝试来源](../../data/reconstruction/v3/container-5/result.json) |
| 6 | 88 / 111 | 23 | 未完成 | [坐标与尝试来源](../../data/reconstruction/v3/container-6/result.json) |
| 7 | 95 / 112 | 17 | 未完成 | [坐标与尝试来源](../../data/reconstruction/v3/container-7/result.json) |
| 8 | 104 / 105 | 1 | 未完成 | [坐标与尝试来源](../../data/reconstruction/v3/container-8/result.json) |
| 9 | 120 / 122 | 2 | 未完成 | [坐标与尝试来源](../../data/reconstruction/v3-bounded-8-9/container-9.json) |
| 10 | 97 / 97 | 0 | 完整通过 | [坐标与尝试来源](../../data/reconstruction/v3/container-10/result.json) |
| 11 | 93 / 93 | 0 | 完整通过 | [坐标与尝试来源](../../data/reconstruction/v3/container-11/result.json) |

复现定义：原 PDF 每柜货物身份集合不变，重新构造逐件坐标后按同一显式模型独立校验；PDF 的栅格图未提供原始 XYZ，不能称原坐标已经恢复。

输入对账已完成：1371 件、134777.37 kg。净空、W02 高度例外、三轴留缝、孔内原宽轴竖直及源表载荷限制均保留。用户已确认取消额外80%底材承托比例下限；当前仍要求正实体承托投影、重心投影位于支撑凸包内，并保留全部源载荷及叠放限制。

完整机器审计见 [replay-status.json](replay-status.json)；阶段与参数事件见 [process-journal.jsonl](process-journal.jsonl)。全局重排的决策、原复现未完成状态及目标见 [workflow.json](workflow.json)；本页逐柜数字仅属于固定配货复现，不是全局候选成绩。输入及候选均记录 SHA256，逐件构造记录接受点与拒绝原因。

本次审计耗时 424 ms；Node v22.23.2。本页由 `src/scripts/audit-pdf-replay.ts` 生成，后续复验会刷新状态。
