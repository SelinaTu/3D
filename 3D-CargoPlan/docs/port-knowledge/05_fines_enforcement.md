<!-- #created 11/08/2026 -->
# 05 · 罚款与执法策略（结构化）

> as-of 2026-10-30 Asia/Shanghai · 深化并结构化 `CLAWHUNT_FINES_AND_ROBOTS_FRONTIER.md` A 节  
> **不构成法律意见或罚单计算器。** 金额会变；产品必须带 as_of + URL。

---

## 0. 分层：行政罚 vs 商业后果 vs 资质后果

| 类型 | 例子 | Port Pack 字段 |
| --- | --- | --- |
| **行政/刑事执法罚** | 中国治超第 43 条；德 BKatV；英 DVSA 固定罚 | `fine_refs[]` + 量级示意 |
| **资质/停业** | 中国一超四罚（条例 66） | `enforcement_consequence` checklist |
| **装船硬条件** | 无 VGM 不得装船（SOLAS） | 阻断状态，不是「罚金」 |
| **商业费用** | 甩柜、搬移、demurrage、船司 VGM 不符费 | `commercial_cost_hints` |

---

## 1. 中国 · CN-road

| ID | 触发 | 公开后果 | 源 | as_of |
| --- | --- | --- | --- | --- |
| CN-OW-MASS | 车货总质量超第 3 条限值 | 未超 1000 kg：警告；其后每超 1000 kg **¥500**，**封顶 ¥30,000**；多项累计亦封顶 3 万 | [gov.cn 治超全文](https://www.gov.cn/zhengce/zhengceku/2021-08/26/content_5633469.htm) 第 43 条 | 规章 2021-08-11；抓取 2026-10-30 |
| CN-OW-DIM | 外廓超限分档 | ¥200 以下 / 200–1000 / 1000–3000 | 同上 | 同上 |
| CN-UNLOAD | 认定违法超限 | 责令卸载等消除违法状态 | 第 36 条 | 同上 |
| CN-SOURCE | 指使强令超限 | 最高 ¥30,000 | 第 49 条 | 同上 |
| CN-FOUR-PENALTY | 1 年内超限 >3 次等 | 吊销营运证 / 停业 / 整顿等（条例 66） | [公路安全保护条例](https://www.gov.cn/gongbao/content/2011/content_1831543.htm) | 抓取 2026-10-30 |
| CN-VGM | 无验证总质量 | **不得装船**；误差执法口径常见叙述 ±5% 且 ≤1 t | MOT SOLAS 执行通知；船舶安全监督规则相关 | 容差条款 **待核实现行条号** |

限值速查（第 3 条）：二轴 18 t … 六轴列车 49 t（驱动轴单轴 46 t）。详见 `02_china_national.md`。

---

## 2. 美国 · US（联邦限值 + 州罚）

| ID | 内容 | 源 |
| --- | --- | --- |
| US-FED-LIMIT | 单轴 20,000 lb；tandem 34,000 lb；GVW 80,000 lb；Bridge Formula 分别执法 | FHWA；23 U.S.C. 127 / 23 CFR 658；[FAQ](https://ops.fhwa.dot.gov/freight/SW/faqs/qa.cfm) |
| US-NO-NATIONAL-FINE | **无**全国统一罚金表 | FAQ |
| US-TX-EX | 德州郡县日程示例（2025-09 起叙述）：轴荷档约 $330 / $780 / $2,030；总重更高至约 $8,530 | 郡县 Commercial Vehicle Enforcement Schedule PDF（二次） |
| US-FL-EX | 按磅等条款；可责令卸载 | [FL Stat. 316.545](https://www.flsenate.gov/Laws/Statutes/2026/0316.545) |
| US-CA | 美西 LA/LB 用加州/郡县日程 | 州 DOT / 郡县公开页 |

产品：`fine_profile=US-CA|US-TX|…` → 类别预警 + 量级；禁止输出「应付 $X」。

---

## 3. 欧盟 / 英国

| 地区 | ID | 机制摘要 | 源 |
| --- | --- | --- | --- |
| 德国 | EU-DE-BKAT | BKatV 按超限**百分比**；司机与所有人分罚；可记点。示例 >7.5 t：司机 €30…€380；所有人 €35…€425 | [BKatV Anhang](https://www.gesetze-im-internet.de/bkatv_2013/anhang_2.html)；[KBA](https://www.kba.de/DE/Themen/ZentraleRegister/FAER/Punktekatalog/achslast_gesamtgewicht_anhaengelast_fahrlaessig.html) |
| 荷兰 | EU-NL-ILT | 轴荷/总重百分比阶梯；强调**部分卸货后轴荷** | [ILT Overbelading](https://www.ilent.nl/onderwerpen/goederenvervoer-over-de-weg/overbelading) |
| 英国 | UK-DVSA | <10% £100；10–<15% £200；≥15% £300；通常 5% 容差（除非 ≥1 t） | [DVSA guidance](https://www.gov.uk/government/publications/guide-to-graduated-fixed-penalties-financial-deposits/dvsa-roadside-checks-fines-and-financial-deposits) |

---

## 4. VGM 全球（装船条件）

| ID | 内容 | 源 |
| --- | --- | --- |
| SOLAS-VGM | 无 VGM 不得装船 | [IMO](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx) |
| VGM-COMMERCIAL | 拒收/甩柜/堆存/搬移费依承运人码头条款 | OOCL/Emirates/TT Club 等行业 FAQ |

---

## 5. 中欧班列偏载

| ID | 内容 | 状态 |
| --- | --- | --- |
| CRE-BIAS | 不超载、不偏载偏重不集重；发现后调偏/改载/延误 | 公开发运须知；**统一行政罚金价目稀缺 → 待核实** |

---

## 6. Rules engine 伪代码

```
if missing(vgm) and voyage.requires_solas: status = BLOCK_LOAD
if road_leg.country == "CN":
    limit = lookup_cn_axle_table(vehicle)
    if gross > limit + 1000kg: warn(fine_band=min(30000, 500*((gross-limit)//1000)))
if road_leg.country == "NL" and stops_partial_unload: recalc_axle_risk()
if dg_flag: attach(port_dg_checklist)
never emit exact_payable_amount_as_judgment
```

---

## 7. 待核实

- [ ] 美各州罚金表年度更新数据源选型  
- [ ] 德 BKatV 附录现行欧元档  
- [ ] 国内船司 VGM 不符附加费抽样  
- [ ] CRE 车站调偏价目  
