<!-- #created 11/08/2026 -->
# 08 · Port Pack 字段契约（喂产品）

> schema 建议版本 **0.1.0** · as-of 2026-10-30  
> 实现可用 JSON 或 YAML；与 CargoPlan plan 的 `pol`/`pod`/`road_legs[]` 关联。

---

## 1. 顶层对象

```yaml
port_pack_version: "0.1.0"
as_of: "2026-10-30"          # Asia/Shanghai 日期
confidence: primary | official_secondary | industry | unverified
disclaimer: "Not legal advice. Fines and local practices change. Show sources to user."

port_id: "CNSHA"             # UN/LOCODE 优先
port_name: "Shanghai"
country: "CN"
region_profile: null         # 如 HK / TW
tier: P0 | P1 | P2

terminals:                   # 可选
  - id: "CNSHA-YANGSHAN"
    smdg_or_bic: null

# 规则包引用
fine_profile: "CN-road"      # 见 05_fines_enforcement.md
vgm:
  required_for_load: true
  method_pref: null          # 1 | 2 | either
  tolerance_note: "CN enforcement narrative ±5% and ≤1t — verify current MSA rule"
  via: null                  # state_agent | depot | carrier | terminal_weigh

checklists:
  - id: vgm_before_load
    topic: vgm
    severity: block
    title: "Verified Gross Mass before vessel load"
    detail: "SOLAS VI/2 — no VGM, no load"
    sources: ["https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx"]
  - id: cn_road_gross_mass
    topic: overweight_road
    severity: warn
    title: "CN highway gross-mass limit by axle config"
    sources: ["https://www.gov.cn/zhengce/zhengceku/2021-08/26/content_5633469.htm"]

fine_refs:
  - id: CN-OW-MASS
    currency: CNY
    cap: 30000
    formula_note: "warn if ≤1000kg over; else 500 per 1000kg; cap 30000"
    sources: ["https://www.gov.cn/zhengce/zhengceku/2021-08/26/content_5633469.htm"]

commercial_cost_hints: []    # demurrage etc — not administrative fines

flags:
  hub_transship: false
  rules_defer_to_pod: false
  axle_after_partial_unload: false
  customs_photo: true
  rail_cre: optional | high | null
  climate_note: null

sources:
  - url: "..."
    layer: L1|L2|L3|L4|L5
    retrieved: "2026-10-30"

knowledge_paths:
  - "port-knowledge/02_china_national.md"
  - "port-knowledge/03_china_ports/shanghai.md"
```

---

## 2. severity 枚举

| severity | UX |
| --- | --- |
| `block` | 不可进入「可装船/可上路」成功态 |
| `warn` | 黄灯；须用户确认/忽略进 Audit |
| `info` | 蓝灯提示（查验留证、ISPM15） |

---

## 3. 与装载计划接合

```
plan.pol -> port_pack(pol)
plan.pod -> port_pack(pod)
plan.road_legs[] -> country fine_profile + axle table
plan.cargo.wood_packing -> ISPM15 checklist
plan.cargo.dg -> port DG checklist
plan.vgm -> merge vgm.required_for_load
```

导出 Audit：`port_pack_version` + 触发的 `checklists[].id` + 用户确认时间戳。

---

## 4. MVP 最少集

演示港 3–5 个（建议：CNSHA, CNNGB, NLRTM, USLAX, SGSIN）：
- VGM block  
- CN-road 或 EU-NL/US-CA fine_profile 示意  
- ISPM15 info  
- customs packing list align（CN）  
- disclaimer  

---

## 5. 非目标

- 自动爬取并信任无审船司 EDI  
- 输出精确应付罚金判决  
- 声称覆盖全球每港 stuffing 法  
