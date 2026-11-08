<!-- #created 11/08/2026 -->
# CargoPlan · 港口与国家海运知识体系（Port Knowledge）

> 版本：**v1.1** · as-of **2026-10-30**（Asia/Shanghai）  
> 项目：ge le · ClawHunt / CargoPlan（舱策）  
> 用途：喂给产品 **Port Pack / Rules engine** 的源知识层——政策、规格、罚款策略、港口作业公开要点、海运 QA 经验。  
> **本知识库不构成法律意见或罚单计算器。** 金额与地方细则会变；产品须展示 as_of + source URL。

---

## 覆盖诚实声明（v1.0 → v1.1）

| | |
| --- | --- |
| **v1.0 问题** | 用户正确指出「这么快搞定肯定有问题」：目录骨架全、**印尼等国别几乎空白**、罚款多转述、缺社媒/实务大样本。 |
| **v1.1 补了什么** | **印尼专章**（ODOL 法定罚金区间 + 道路 MST + PM 25/2022 VGM + 五大港分册）；**国际海运 QA 语料**（官方 FAQ + X 多查询归档样本 + Reddit 二级）；`data/x_maritime_qa_sample.yaml`。 |
| **仍不是什么** | 全球每港 stuffing 禁令库；精确应付卢比/美元判决书；穷尽 X 全网。 |
| **禁止** | 编造港别装柜法、编造未核到的 Rupiah 罚金、把承运人滞期费写成「海关罚款」、把标题党 Rp50 miliar 当立法。 |

---

## 1. 一句话

**没有**「全球每港一套 stuffing 禁令」可爬成标准库。真正可结构化、有公信力的是：

1. **国际公约层**（SOLAS VGM / CTU / CSC / ISPM15 / IMDG 高层）  
2. **国家实施层**（中国治超；**印尼 ODOL + PM 25/2022 VGM**；…）  
3. **港口/码头作业实践**（能核实的写清 URL；不能核实标 **待核实**）  
4. **承运人商业条款**（滞期、VGM 附加费——非统一行政罚）  
5. **开源主数据**（UN/LOCODE、WPI、ISO type、BIC Facility）  
6. **实务 QA / X 话题簇**（经验黄灯，裁判仍看官方）

CargoPlan 卖的是 **装载证据 + Port Pack checklist**，不是冒充港方法条。

---

## 2. 目录树

| 路径 | 内容 |
| --- | --- |
| `00_taxonomy.md` | 分类法与字段映射 |
| `01_international_conventions.md` | IMO/UNECE/IPPC 等公约要点 + 官方链 |
| `02_china_national.md` | **中国专章（厚）** |
| `02b_indonesia_national.md` | **印尼专章（v1.1）**：ODOL / JBI / VGM / ISPM15 |
| `03_china_ports/` | 上海/宁波舟山/深圳/青岛/天津/广州/厦门/大连 |
| `04_global_ports/` | Singapore / Rotterdam / … + **`indonesia/`** |
| `05_fines_enforcement.md` | 罚款与执法 |
| `06_specs_iso_gb.md` | 柜型规格 ISO/GB |
| `07_opensource_and_datasets.md` | 可复用开源/开放数据 |
| `08_port_pack_schema.md` | Port Pack JSON/YAML 字段建议 |
| `09_maritime_shipping_qa_experience.md` | **国际海运 QA / X 经验簇（v1.1）** |
| `13_practitioner_inclusion.md` | **实务判断与助手检索（978 张证据卡，单价不抄）** |
| `data/ports_index.yaml` | 港索引（含 ID 五港） |
| `data/sources_catalog.yaml` | 源目录 |
| `data/x_maritime_qa_sample.yaml` | X 样本表（counts + example links） |

交叉引用：
- 港口分级：`../CLAWHUNT_PORTS_P0_P1.md`
- 罚款长表：`../CLAWHUNT_FINES_AND_ROBOTS_FRONTIER.md`
- 产品 Port Pack：`../CLAWHUNT_PRODUCT_PLAN_FULL.md`

---

## 3. 诚实口径（写进产品 UI）

| 可做 | 不可做 |
| --- | --- |
| 引用部委/UU/Permenhub 原文区间 + URL + as_of | 编造「某港禁止某摆法」 |
| 把公约义务变成 checklist（有 VGM / ISPM15 标记…） | 输出「你应付罚金精确 ¥/$/Rp」判决 |
| 用 UN/LOCODE + 国别 fine_profile 驱动规则包 | 把承运人滞期费当成行政罚款 |
| 港别 stub：仅填已核实字段 | 假装每港有机器可读 stuffing schema |
| 引用 X 作话题热度与措辞 | 把未核立法的媒体标题当罚则 |

---

## 4. 如何喂 Port Pack

1. 装载规划完成 → 选 **POL / POD / 公路段国别**  
2. Rules engine 加载 `data/ports_index.yaml` + 对应 md 中的 `checklists[]` / `fine_refs[]`  
3. UI 展示：红灯（缺 VGM、超公路 MST/JBI）/ 黄灯（偏载、ISPM15、承运人 WDF）/ 蓝灯（查验留证）  
4. Audit 导出：plan_id + port_pack_version + sources[]  
5. FAQ 面板可读 `09_maritime_shipping_qa_experience.md` 主题簇  

字段契约见 `08_port_pack_schema.md`。

---

## 5. 维护

| 项 | 节奏 |
| --- | --- |
| 中国治超 / VGM / 海关规章 | 半年扫部委公开页 |
| **印尼 ODOL / PM VGM / Zero ODOL 2027** | 季度扫 Kemenhub + JDIH |
| 罚款示例（美州/欧国） | 季度；金额变更标 as_of |
| X / 实务 QA 样本 | 重大政策节点补一页检索 |
| UN/LOCODE / WPI | 按上游发布拉取 |

路径（box）：`/workspace/clawhunt/docs/port-knowledge/`  
路径（Mac）：`/Users/lege/Documents/ChatGPT/集装箱运筹/docs/port-knowledge/`

## Attention topics（关注层）

详尽主题百科（与地球仪双层对齐）：[`topics/`](topics/) · JSON 源 `globe/data/topics/`  
调研附篇：[`10_maritime_knowledge_pain_attention.md`](10_maritime_knowledge_pain_attention.md)

knowledge **v1.2.0** · as_of 2026-10-31

