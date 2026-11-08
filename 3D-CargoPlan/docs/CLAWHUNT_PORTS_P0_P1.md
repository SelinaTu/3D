<!-- #created 11/08/2026 -->
# CargoPlan · 全球主流集装箱港口 P0 / P1 清单（Rules Pack 广度）

> 文档版本：2026-10-30（Asia/Shanghai）· **v1.2**  
> v1.2：`port-knowledge/` **v1.1** — 印尼 ODOL/VGM 专章 + 五大港分册 + 国际海运 QA/X 样本  
> v1.1：知识体系落地 → 详见 **`port-knowledge/`**（公约/中国专章/分港/罚款结构化/开源数据/Port Pack schema）  
> 项目：ge le · ClawHunt / 集装箱运筹（CargoPlan Agent / 舱策）  
> 性质：**产品广度附件**——为 Port Pack / Rules Pack 划定覆盖优先序；**不是**「每港一套装柜法」百科。  
> TEU 口径：除非另注，均为 **2024 年吞吐量**，主源 [Lloyd's List One Hundred Container Ports 2025](https://www.lloydslist.com/one-hundred-container-ports-2025)（日文港湾协会转载表 [phaj.or.jp](https://www.phaj.or.jp/distribution/earth/top100.html) 作可读明细）。交叉参考 World Shipping Council / 行业转载、中国交通运输部港口统计报道。  
> 冲突或未独立复核处标 **待核实**。产品**不得编造**港别独家 stuffing 法规。

---

## 1. 分级标准（写进产品）

| 级别 | 定义 | 数量目标 | Port Pack 深度 |
| --- | --- | --- | --- |
| **P0** | （A）全球 TEU 顶级枢纽（约全球 Top ~25 且对中国出口走廊关键）**或**（B）中国出口主走廊必经枢纽（含主要 EU / US / ME / SEA 门户） | **15–25** | 完整 Port profile stub + MVP/Phase2 优先填表 |
| **P1** | 次一档高量或战略重要：区域枢纽、美西/美东次级、地中海、印度、拉美关键港、澳新相关等 | **25–40** | 摘要行 + Phase2 后半段填表 |
| **P2** | Watchlist only：量级靠后或战略观察（如部分大洋洲次级港） | 一行列表 | 不建深档 |

**入选原则（同时满足至少一条）：**

1. Lloyd's 2024 TEU 排名靠前；  
2. 对中国出口 / 亚欧 / 跨太 / 中欧班列海铁衔接有公开可核的走廊意义；  
3. 目的港侧道路轴荷 / VGM / 海关查验对装载规划有产品化价值。

**明确不做：** 宣称「某港禁止某摆法」而无公开来源；用港名当护城河替代 Agent 证据链。

---

## 2. 数量总览

| 级别 | 数量 | 备注 |
| --- | ---: | --- |
| P0 | **22** | 见 §3 |
| P1 | **35** | 见 §4 |
| P2 | 8（一行） | 见 §5 |
| **合计建档目标** | **57**（P0+P1） | MVP 只演示 **3–5** 港；Phase2 先填满 P0 再扩 P1 |

---

## 3. P0 清单（22）— 完整行

TEU 单位：百万 TEU（m TEU），四舍五入到 0.1；排名 = Lloyd's 2024（One Hundred Ports 2025 报道年）。

### 3.1 Greater China（8）

| Port | Country/Region | ~TEU 2024 / Rank | Why P0 | Load-planning relevance（已知公开点） | Port profile stub 关键字段 |
| --- | --- | --- | --- | --- | --- |
| **Shanghai** 上海 | CN | **51.5** / #1 | 全球第一；中国出口旗舰 | 多终端 No VGM No Load 常见；MSA 容差公开叙述 ±5% 或 1 t 取小（船司本地指引）；洋山自动化堆场 ≠ 柜内机器人 | `vgm_cutoff_hint`, `vgm_method_pref`, `fine_profile=CN`, `customs_photo=true`, `rail_cre=optional` |
| **Ningbo-Zhoushan** 宁波舟山 | CN | **39.3** / #3 | 全球第三；长三角出口 | VGM 常须经地方船代再进码头（船司指引）；海铁联运量大 | `vgm_via_state_agent`, `rail_sea_intermodal=high`, `fine_profile=CN` |
| **Shenzhen** 深圳（含盐田/蛇口等） | CN | **33.4** / #4 | 珠三角出口主门户 | 终端政策按码头；外贸航线密；工程柜/家具柜常见走廊 | `terminal_cluster=YANTIAN/SHEKOU/...`, `customs_photo=true` |
| **Qingdao** 青岛 | CN | **30.9** / #5 | 北方外贸 + 海铁全国前列公开叙事 | VGM 经堆场/指定路径；中欧班列/海铁；自动化码头公开强 | `rail_cre=high`, `vgm_via_depot`, `yard_agv=high`, `in_box_robot=low` |
| **Guangzhou** 广州（南沙等） | CN | **26.1** / #6 | 珠三角腹地 | 内贸+外贸；南沙枢纽 | `terminal_cluster=NANSHA/...`, `fine_profile=CN` |
| **Tianjin** 天津 | CN | **23.3** / #8 | 京津冀出口 | VGM cutoff 与进港舱单时点挂钩（船司本地表）；无人集卡报道 | `vgm_cutoff_vs_gatein`, `yard_agv=med` |
| **Hong Kong** 香港 | CN/HK | **13.7** / #12 | 转口与华南衔接；跌出全球前十仍 P0 走廊 | 承运人申报；Method 2 相关本地实践（船司表）；与大陆口岸 checklist 分开 | `region_profile=HK`, `vgm_declare_to=carrier` |
| **Xiamen** 厦门 | CN | **12.3** / #14 | 东南出口 | No VGM No Load 终端常见；2024 箱量口径曾受短驳统计影响 → **TEU 同比解读待核实** | `vgm_policy=no_vgm_no_load`, `stats_caveat=true` |

### 3.2 NE Asia（2）

| Port | Country | ~TEU / Rank | Why P0 | Load-planning notes | Stub fields |
| --- | --- | --- | --- | --- | --- |
| **Busan** 釜山 | KR | **24.4** / #7 | 东北亚转运枢纽；中国近洋/中转 | 转运柜多；目的港轴荷在下一程 | `hub_transship=true`, `fine_profile=link_next_leg` |
| **Kaohsiung** 高雄 | TW | **9.2** / #21 | 台海走廊战略港 | 区域规则包独立于大陆 | `region_profile=TW`, `vgm_local=待核实` |

### 3.3 SE Asia（4）

| Port | Country | ~TEU / Rank | Why P0 | Load-planning notes | Stub fields |
| --- | --- | --- | --- | --- | --- |
| **Singapore** | SG | **41.1** / #2 | 全球第二；亚欧/跨太中转 | 中转主导；VGM/目的国规则在下一程；极少「本港 stuffing 独法」 | `hub_transship=true`, `rules_defer_to_pod=true` |
| **Port Klang** 巴生 | MY | **14.6** / #10 | 马六甲西岸枢纽 | 终端过磅可选叙述（船司区域表） | `vgm_terminal_weigh=optional` |
| **Tanjung Pelepas** | MY | **12.3** / #15 | 马来第二枢纽 / 联盟母港 | 中转属性强 | `hub_transship=true` |
| **Ho Chi Minh City**（含附近集群口径） | VN | **9.2** / #22 | 越南出口对中国+全球供应链关键 | 近 Cai Mep 分工；工程/家具出口走廊 | `export_corridor=VN`, `cluster_with=CaiMep` |

### 3.4 Middle East（1）

| Port | Country | ~TEU / Rank | Why P0 | Notes | Stub |
| --- | --- | --- | --- | --- | --- |
| **Jebel Ali** | AE | **15.5** / #9 | 中东第一枢纽 | 再出口/中转；高温绑扎/加固实践待核实录入 | `hub_reexport=true`, `climate_note=hot` |

### 3.5 Europe North（3）

| Port | Country | ~TEU / Rank | Why P0 | Notes | Stub |
| --- | --- | --- | --- | --- | --- |
| **Rotterdam** | NL | **13.8** / #11 | 欧洲第一；深水门户 | ILT 轴荷/总重执法教育公开（部分卸货可致轴荷违规）；EU-road + NL risk | `fine_profile=EU-NL`, `axle_after_partial_unload=true` |
| **Antwerp-Bruges** | BE | **13.5** / #13 | 欧洲第二级枢纽 | EU-road；内陆驳船/铁路腹地 | `fine_profile=EU`, `barge_rail=high` |
| **Hamburg** | DE | **7.8** / #27 | 德北门户 + 中欧班列欧侧常见枢纽叙事 | BKat 轴荷罚金档；Rail-CRE 欧侧衔接 | `fine_profile=EU-DE`, `rail_cre_eu_hub=true` |

### 3.6 North America（3）

| Port | Country | ~TEU / Rank | Why P0 | Notes | Stub |
| --- | --- | --- | --- | --- | --- |
| **Los Angeles** | US | **10.3** / #16 | 美西进口旗舰 | 州/郡超重罚无统一联邦表；选 CA 州 profile；码头 demurrage 商业成本 | `fine_profile=US-CA`, `overweight_corridor=I-710等待核实` |
| **Long Beach** | US | **9.6** / #19 | 与 LA 成对美西门户 | 同走廊轴荷/底盘车 | `fine_profile=US-CA`, `pair_with=LA` |
| **New York / New Jersey** | US | **8.7** / #24 | 美东旗舰 | 东岸道路限值/桥梁公式；冬季作业待核实 | `fine_profile=US-NY/NJ`, `bridge_formula=true` |

### 3.7 Africa / Med gateway（1）

| Port | Country | ~TEU / Rank | Why P0 | Notes | Stub |
| --- | --- | --- | --- | --- | --- |
| **Tanger Med** | MA | **10.2** / #17 | 非洲第一集装箱港；地中海西口 | 欧非中转；Rules 多跟下一程 EU/非洲公路 | `hub_africa_med=true`, `rules_defer_to_pod=true` |

**P0 Top 10（按 2024 TEU）:** Shanghai, Singapore, Ningbo-Zhoushan, Shenzhen, Qingdao, Guangzhou, Busan, Tianjin, Jebel Ali, Port Klang.

---

## 4. P1 清单（35）— 摘要

| Region | Port | Country | ~TEU / Rank | Why P1 | 一句话产品相关 |
| --- | --- | --- | --- | --- | --- |
| Greater China | Taicang / Suzhou 太仓（苏州港口径） | CN | 9.7 / #18 | 长江口喂给/近洋 | 内河喂给 + VGM 链路待核实 |
| Greater China | Beibu Gulf 北部湾 | CN | 9.0 / #23 | 西部陆海新通道 | 海铁/东盟走廊 checklist |
| Greater China | Rizhao 日照 | CN | 6.7 / #32 | 北方高增 | 大宗+箱；轴荷公路严 |
| Greater China | **Lianyungang** 连云港 | CN | 6.7 / #33 | **新亚欧陆桥桥头堡** | **Rail-CRE / 中亚班列优先 profile** |
| Greater China | Yingkou 营口 | CN | 5.6 / #34 | 东北 | 季节/冻货待核实 |
| Greater China | Dalian 大连 | CN | 5.4 / #40 | 东北出海 | VGM 经船代常见 |
| Greater China | Yantai 烟台 | CN | 5.1 / #42 | 山东半岛 | 客货/近洋 |
| Greater China | Dongguan 东莞/虎门 | CN | 4.0 / #49 | 珠三角喂给 | 与深圳集群联动 |
| Greater China | Nanjing 南京 | CN | 3.7 / #56 | 长江内河枢纽 | 内河箱限高限重待核实 |
| NE Asia | Tokyo 东京 | JP | 4.7 / #45 | 日本首都圈 | JP VGM 终端政策（船司表） |
| NE Asia | Yokohama 横滨 | JP | 3.1 / #70 | 京浜 | 同 JP profile |
| NE Asia | Incheon 仁川 | KR | 3.6 / #61 | 韩首都圈 | 近洋 |
| NE Asia | Gwangyang 光阳 | KR | 2.0 / #95 | 韩南 | 工业腹地 |
| SE Asia | Laem Chabang | TH | 9.6 / #20 | 泰国主出口 | 汽车/工业柜 |
| SE Asia | Tanjung Priok | ID | 7.8 / #26 | 印尼雅加达 | **ODOL/VGM 专章** → `port-knowledge/02b_indonesia_national.md` + `04_global_ports/indonesia/tanjung_priok.md` |
| SE Asia | Hai Phong | VN | 7.2 / #29 | 越南北部 | 华南近洋 |
| SE Asia | Cai Mep | VN | 7.1 / #30 | 南部深水 | 与 HCMC 集群 |
| SE Asia | Manila | PH | 5.5 / #36 | 菲首都 | 岛链分拨 |
| SE Asia | Tanjung Perak | ID | 4.3 / #47 | 泗水 | 印尼东爪哇 |
| South Asia | Mundra | IN | 8.2 / #25 | 印西出口旗舰 | IN VGM 容差船司表 ±1000 kg 叙述 |
| South Asia | Colombo | LK | 7.8 / #28 | 南亚中转 | hub_transship |
| South Asia | Jawaharlal Nehru (JNPT) | IN | 7.1 / #31 | 印孟买侧 | 同 IN profile |
| South Asia | Chittagong | BD | 3.3 / #68 | 孟加拉出口 | 成衣柜；查验留证 |
| Middle East | Abu Dhabi | AE | 5.4 / #39 | 阿联酋第二 | 与 Jebel Ali 分工 |
| Middle East | Jeddah | SA | 3.7 / #55 | 红海西岸 | 红海绕航年份波动 **待核实** |
| Middle East | Salalah | OM | 3.3 / #66 | 阿曼中转 | hub |
| Middle East | Dammam | SA | 3.3 / #67 | 沙特东岸 | 工业腹地 |
| Europe S/Med | Valencia | ES | 5.5 / #38 | 西地中海 | EU-ES |
| Europe S/Med | Piraeus | GR | 4.8 / #43 | 东地中海枢纽 | 中欧南线叙事 |
| Europe S/Med | Algeciras | ES | 4.7 / #44 | 直布罗陀口 | 中转 |
| Europe S/Med | Bremerhaven | DE | 4.4 / #46 | 德北第二 | Rail/EU-DE |
| Europe S/Med | Barcelona | ES | 3.9 / #54 | 西地中海 | EU |
| Europe S/Med | Felixstowe | GB | 3.6 / #59 | 英国主箱港 | **UK-road risk** £100–300 档 |
| Europe S/Med | HAROPA (Le Havre 等) | FR | 3.1 / #69 | 法国门户 | EU-FR 待核实细则 |
| N America | Savannah | US | 5.5 / #35 | 美东南高速增长 | US-GA 州罚金表 |
| N America | Houston | US | 4.1 / #48 | 美湾 | US-TX 超重罚示例已在主方案 |
| N America | Virginia | US | 3.5 / #62 | 美东 | US-VA |
| N America | Vancouver | CA | 3.5 / #63 | 加西 | CA 公路限值待核实 |
| N America | Seattle/Tacoma | US | 3.3 / #65 | 美西北 | US-WA |
| LatAm | Santos | BR | 5.5 / #37 | 巴西主港 | BR 规则待核实 |
| LatAm | Colón | PA | 5.4 / #41 | 运河大西洋侧 | 转运 |
| LatAm | Balboa | PA | 4.0 / #50 | 运河太平洋侧 | 转运 |
| LatAm | Manzanillo | MX | 3.9 / #52 | 墨西海岸 | 近岸外包走廊 |
| LatAm | Cartagena | CO | 3.7 / #58 | 哥伦比亚 | 加勒比 |
| Africa | Port Said | EG | 3.9 / #53 | 苏伊士 | 中转/绕航敏感 |
| Africa | Durban | ZA | 2.7 / #79 | 南非主箱港 | 非洲南端 |
| Oceania | Melbourne | AU | 3.4 / #64 | 澳主港之一 | AU No VGM No Gate-in 叙述（船司表） |
| Oceania | Sydney | AU | 2.8 / #74 | 澳东 | 同 AU profile |

> 上表 P1 计数：Greater China 9 + NE Asia 4 + SE Asia 6 + South Asia 4 + ME 4 + Europe 7 + N America 5 + LatAm 5 + Africa 2 + Oceania 2 = **48** 行。为贴合「25–40」目标，**Phase2 建档优先子集（35）** 取：去掉 Yingkou、Yantai、Dongguan、Nanjing、Gwangyang、Tanjung Perak、Dammam、Barcelona、Seattle/Tacoma、Cartagena、Port Said、Sydney 共 12 个延后到 P1-backlog / 贴近 P2——**正式 P1 建档 = 35**；上表全列保留为「P1 候选全景」，产品路线图以 35 为承诺数。

**正式 P1（35）优先建档名单：**  
Taicang, Beibu Gulf, Rizhao, Lianyungang, Dalian, Tokyo, Yokohama, Incheon, Laem Chabang, Tanjung Priok, Hai Phong, Cai Mep, Manila, Mundra, Colombo, JNPT, Chittagong, Abu Dhabi, Jeddah, Salalah, Valencia, Piraeus, Algeciras, Bremerhaven, Felixstowe, HAROPA, Savannah, Houston, Virginia, Vancouver, Santos, Colón, Balboa, Manzanillo, Melbourne.

（其余为 P1-backlog，见上表未入 35 者 + §5。）

---

## 5. P2 Watchlist（一行）

Auckland (NZ)、Osaka、Kobe、Nagoya、Charleston、Oakland、Callao、Lázaro Cárdenas、Guayaquil、San Antonio (CL)、Alexandria、Lomé、Marsaxlokk、Genoa、Gdańsk、Bandar Abbas、Chittagong 已入 P1 则不再重复。  
**Auckland**：未进 Lloyd's Top 100（2024）；若用户大洋洲业务需要可升 P1，否则仅 watchlist——**不编造 TEU**。

---

## 6. Port profile schema stub（产品字段）

每个 P0/P1 港一条 JSON 形态配置（示意）：

```json
{
  "port_id": "CNSHA",
  "name": "Shanghai",
  "tier": "P0",
  "country": "CN",
  "teu_year": 2024,
  "teu_m": 51.5,
  "lloyds_rank_2024": 1,
  "source_urls": ["https://www.lloydslist.com/one-hundred-container-ports-2025"],
  "vgm": {
    "method_preference": "1|2|either|unknown",
    "no_vgm_no_load": true,
    "declare_to": "carrier|terminal|state_agent|mixed",
    "cutoff_hint": "string|待核实",
    "tolerance_note": "CN MSA ±5% or 1t whichever smaller — 船司本地指引"
  },
  "road": {
    "fine_profile_id": "CN|US-CA|US-TX|EU-NL|EU-DE|UK|...",
    "axle_corridor_notes": "string|待核实"
  },
  "rail": {
    "cre_link": "none|optional|high",
    "cre_notes": "偏载偏重用全局 Rail-CRE profile；港别加严待核实"
  },
  "customs": {
    "photo_checklist": true,
    "inspection_friendly_layout_optional": true
  },
  "ops": {
    "hub_transship": false,
    "rules_defer_to_pod": false,
    "yard_automation": "high|med|low|unknown",
    "in_box_robot_maturity": "low|pilot|unknown"
  },
  "do_not_claim": ["unique_local_stuffing_geometry_law_without_source"]
}
```

Checklist 勾选项（UI）：

- [ ] VGM method preference / No VGM No Load  
- [ ] VGM cutoff hint（非法定证书）  
- [ ] Axle / overweight corridor notes → 链接 `fine_profile`  
- [ ] Rail CRE link（none/optional/high）  
- [ ] Customs stuffing photo checklist  
- [ ] Hub：规则是否延后到 POD  
- [ ] 来源 URL + 版本日期  
- [ ] **待核实** 标记  

---

## 7. 产品路线（与主方案对齐）

| 阶段 | Port Pack 广度 | 深度 |
| --- | --- | --- |
| **Hackathon MVP** | **3–5 演示港**（建议：Shanghai、Ningbo、Rotterdam、Los Angeles、Qingdao 五选三～五） | Checklist 示意 + 链接全球 Rules（VGM/CTU/轴荷/罚款摘要）；**不**假装已核完每港独法 |
| **Phase 2a** | 填满 **全部 22 个 P0** stub | 船司/码头公开 VGM 表、fine_profile 绑定、CRE 港标记 |
| **Phase 2b** | **35 个正式 P1** | 摘要→可勾选；客户可覆盖私有字段 |
| **Later** | P1-backlog + P2 按客户走廊开通 | 仍禁止无来源「港别装柜禁令」营销 |

**竞品对照一句：** EasyCargo / 装箱大师等几乎不做「全球港 Port Pack 广度」；我们的差异是 **Rules Pack × Port Pack 广度 + 风险提示**，不是再做一个 3D 引擎。

---

## 8. 来源

1. Lloyd's List — [One Hundred Container Ports 2025](https://www.lloydslist.com/one-hundred-container-ports-2025)；分析稿 [Resilient ports…](https://www.lloydslist.com/LL1154615/Resilient-ports-anchor-trade-amid-the-turbulence)（全球百港合计 743.6m TEU，+8.1%）。  
2. 日本港湾协会转载明细表 — [phaj.or.jp top100](https://www.phaj.or.jp/distribution/earth/top100.html)（注明出处 Lloyd's List ONE HUNDRED PORTS 2025；速报值）。  
3. World Ports Organization 转述 Lloyd's 排名要点 — [worldports.org](https://www.worldports.org/worlds-top-ports-see-strongest-expansion-in-nearly-a-decade/)。  
4. 行业转载 Top50（对照用）— 如 Goliath / 航运在线等；与 Lloyd's 前十一致时采用，冲突标待核实。  
5. 中国交通/港口圈报道 — 国内港名次与上海/宁波等量级交叉。  
6. VGM 本地实践 — MSC China local VGM、OOCL China/terminal VGM 表、Skuld 中国实施规则英译 PDF 等（**商业/船司指引，非立法全文**）。  
7. 连云港陆桥 / 中欧班列公开材料 — 连云港市政府港航介绍、Index1520 2024 欧亚铁路箱运报告等。  
8. 主方案罚款与轴荷 — `CLAWHUNT_PRODUCT_PLAN_FULL.md` §4.4、`CLAWHUNT_FINES_AND_ROBOTS_FRONTIER.md`。

**待核实（港口数据）：**

- [ ] Lloyd's 付费全文与 phaj 转载逐港 TEU 是否 100% 一致（个别港 WTCP 等第三方有修订标记 †）。  
- [ ] 「Suzhou / Taicang」与「Hong Kong」在不同榜单的统计口径。  
- [ ] 各 P0 码头现行 No VGM No Gate-in vs No Load 差异表（随船司/码头变更）。  
- [ ] 美西 I-710 等 overweight 走廊具体限值与罚则（州/郡）。  
- [ ] Auckland 等 P2 升档所需官方 TEU。

---

## 9. 与主方案交叉引用

- 主方案：`CLAWHUNT_PRODUCT_PLAN_FULL.md` §4.5 Port Pack 广度（v1.2+）  
- 罚款：`CLAWHUNT_FINES_AND_ROBOTS_FRONTIER.md`  
- 原则重申：**Port Pack = 可配置 checklist + 区域 fine/VGM/rail 链接；不是每港发明一套 packing law。**
- **深度知识库（v1.1）：** `port-knowledge/README.md` — 中国专章、**印尼 ODOL/VGM**、分港档案、罚款结构化、海运 QA/X 样本、`data/ports_index.yaml`、Port Pack schema 0.1
