<!-- #created 11/08/2026 -->
# 00 · 知识分类法（Taxonomy）

> as-of 2026-10-30 Asia/Shanghai · Port Knowledge v1.0

## 1. 六层洋葱（产品必须分清）

| Layer ID | 名称 | 权威性 | 典型内容 | Port Pack 用法 |
| --- | --- | --- | --- | --- |
| L1 | **国际公约 / 实践守则** | 最高（条约或全球守则） | SOLAS VGM、CSC、CTU Code、ISPM15、IMDG | 全局 checklist；国别默认继承 |
| L2 | **国家实施规章** | 高（部委/国会） | 中国治超部令、海事 VGM 通知、海关集装箱办法、港口危货规定；美 FHWA；德 BKatV | `country_profile` / `fine_profile` |
| L3 | **港口 / 码头作业要求** | 中–高（港务/码头公开页） | No VGM No Load、进闸过磅、危品直装直取、预约查验 | `port_id` checklists；无公开则空 |
| L4 | **承运人 / 码头商业条款** | 中（合同） | VGM 附加费、滞期 demurrage、改船费 | `commercial_cost_hints`；**非行政罚** |
| L5 | **规格与主数据** | 高（ISO/GB/开放数据） | ISO 668/6346、GB/T 1413、UN/LOCODE、WPI | 柜型、港码、坐标 |
| L6 | **产业叙述 / 二手报道** | 低 | 媒体「某港智能监管」 | 仅作线索；标 **待核实** 后方可升 L3 |

## 2. 主题标签（topics）

`vgm` · `overweight_road` · `axle_load` · `customs_inspection` · `quarantine_container` · `dangerous_goods` · `wood_packing_ispm15` · `csc_plate` · `ctu_packing` · `rail_cre_bias` · `terminal_gate` · `demurrage` · `specs_iso` · `opensource_data`

## 3. 置信度枚举

| confidence | 含义 |
| --- | --- |
| `primary` | 部委/IMO/ISO/国标公开原文或官方 HTML/PDF |
| `official_secondary` | 地方政府转载、港务集团新闻、船司本地指引（可核但非立法） |
| `industry` | WSC/TT Club/行业协会 FAQ |
| `unverified` | 二手报道或字段空缺 → UI 显示待核实 |

## 4. 与装载规划的连接点

| 规划事件 | 触发的知识 |
| --- | --- |
| 选定柜型 / 货重 | L5 额定质量；L2 公路总质量限值 |
| 生成装序 / 重心 | L1 CTU；L2 CRE 偏载叙述 |
| 导出可装船草稿 | L1+L2 VGM 硬条件 |
| 含木质包装 | L1 ISPM15 |
| 危品 SKU | L2 港口危货 + IMDG 高层提示 |
| 选 POL/POD | L3 port checklists + L2 fine_profile |
| 多站点卸货后公路 | L2 轴荷（如 NL 部分卸货后轴荷）；欧洲段另见 `13_practitioner_inclusion.md` |
| 订舱、截关、进闸、费用争议 | `13_practitioner_inclusion.md`：只收能改判断的区分和时钟，不收码头单价 |

## 5. 反模式

- 把「港区自动化堆场」写成「柜内 stuffing 法规」  
- 把「一超四罚」写成固定罚金表（它是资质/停业类后果，罚金另见治超第 43 条）  
- 用 EasyCargo FAQ 替代 IMO/部委源  
