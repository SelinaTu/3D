<!-- #created 11/08/2026 -->
# 印尼国家专章 · ODOL / 公路超限 / VGM / 检疫

> Port Knowledge **v1.1** · as-of **2026-10-30**（Asia/Shanghai）  
> 性质：印尼**公路出门段 + 海运 VGM/柜况**可核要点；**不构成法律意见**。  
> 金额与执法节奏会变；产品须展示 as_of + source URL。未核到的标 **待核实**——**禁止编造卢比罚金**。

---

## 0. 一句话（给产品 / 路演）

印尼柜货落地后最痛的不是「ISO 柜自重上限」，而是 **ODOL（Over Dimension Over Loading）公路执法** + **无 VGM 不准装船** + 承运人 **重量不符附加费**。  
CargoPlan 应在装载规划阶段同时对照：**CSC max gross（柜）**、**VGM（船）**、**JBI/JBKI + 轴载 MST + 道路等级（出门公路）**。三者任一超限都可能「装得上船、出不了港门 / 上不了路」。

---

## 1. 主要集装箱港（国别索引）

| UN/LOCODE（常用） | 港名 | 城市 | 备注 |
| --- | --- | --- | --- |
| **IDTPP** | Tanjung Priok | Jakarta | 全国物流枢纽；Pelindo Regional 2；多码头（JICT / NPCT1 等） |
| **IDSUB** | Tanjung Perak | Surabaya | 东爪哇主港；TPS 等 |
| **IDBLW** | Belawan | Medan | 苏门答腊北；BNCT 等 |
| **IDMAK** | Makassar | Makassar | 苏拉威西枢纽 |
| **IDSRG** | Tanjung Emas | Semarang | 中爪哇 |

分册见 `04_global_ports/indonesia/`。TEU 排名与精确 LOCODE 以 UN/LOCODE + Lloyd's 再核（**待核实** 各码头经营主体变更）。

---

## 2. ODOL：定义、公路限值、罚款（有出处）

### 2.1 定义

- **Over Dimension**：车辆尺寸不符合出厂/技术标准（含未经合规改型、未完成 uji tipe）。  
- **Over Loading**：超过允许载重（JBI / JBKI）或违反装载方式、道路等级限制。  
官方用语来源：Kemenhub / Ditjen Hubdat「Stop ODOL」宣传；执法协调见 Korlantas（2025 起强化 Zero ODOL 进程）。

### 2.2 道路等级与轴载上限（UU 22/2009 Pasal 19）

| 道路等级 | 宽 | 长 | 高 | **MST（最重轴）** |
| --- | --- | --- | --- | --- |
| Kelas I | ≤2.5 m | ≤18 m | ≤4.2 m | **10 t** |
| Kelas II | ≤2.5 m | ≤12 m | ≤4.2 m | **8 t** |
| Kelas III | ≤2.1 m | ≤9 m | ≤3.5 m | **8 t**（特定可更低） |
| Kelas khusus | >2.5 / >18 等 | — | ≤4.2 m | **>10 t** |

出处：[UU No. 22 Tahun 2009](https://pelayanan.jakarta.go.id/download/regulasi/undang-undang-nomor-22-tahun-2009-tentang-lalu-lintas-dan-angkutan-jalan.pdf)（Jakarta 服务门户 PDF 镜像；正式文本亦见 JDIH）。

**产品启示：** 40′ 拖挂总长常 ~16 m → **仅合法于 Kelas I**；进 Kelas II 园区可能必须换 20′ 短车。High Cube + 标准底盘易触碰 4.2 m 总高——建议 gooseneck（行业实践，非本库罚则）。

### 2.3 JBI / JBKI（车辆允许总重）

- **JBI**：Jumlah Berat yang Diizinkan（单车允许总重）。  
- **JBKI**：Jumlah Berat Kombinasi yang Diizinkan（列车组合允许总重）。  
- 出处骨架：**Permenhub No. 18 Tahun 2021**（监督公路货运装载；PDF：[BPK Download](https://peraturan.bpk.go.id/Download/311148/2021pmkemenhub018.pdf)）——要求遵守装载方式、**daya angkut（JBI/JBKI）**、尺寸、道路等级。  
- **具体吨位写在车辆 KIR / STNK / uji berkala**，不是「20′ 柜 ISO 30.48 t 就能上路」。  
- 行业转述（Forwarder.ai 等）：常见 2+2 轴拖挂 JBKI 约 **36 t** 量级、多轴可到 **40–45 t**——**仅为实践区间，待核实到具体车型牌照**；产品应提示「向车队索取 KIR 上的 JBI/JBKI」，**不要写死卢比或吨位判决**。

### 2.4 法定罚则金额（UU 22/2009 —— 可引用）

| 条款 | 针对 | 法定上限（原文量级） | 备注 |
| --- | --- | --- | --- |
| **Pasal 277** | 未履行 uji tipe 等技术义务而运营（常用于 **over dimension / 非法改型** 语境） | 监禁最长 **1 年** 或罚金最多 **Rp 24.000.000** | Ditjen Hubdat Stop ODOL 页、Kompas/Korlantas 报道均引用 |
| **Pasal 307** | 货运未遵守装载方式、**daya angkut**、尺寸 | 拘役最长 **2 个月** 或罚金最多 **Rp 500.000** | 多方指 overload 罚金过轻、威慑不足 |
| Pasal 169 等 | 未经许可改型等 | 常见转述 Rp 500.000 / 2 个月 | 以 UU 全文为准 |

出处交叉：  
- [Hubdat Stop ODOL（BPTD Sulteng）](https://hubdat.dephub.go.id/id/bptd/sulteng/publikasi/stop-odol/)（抓取时偶发 502，以站点为准）  
- [Kemenhub Menhub ODOL 声明](https://kemenhub.go.id/post/read/menhub-dudy-tegaskan-penanganan-angkutan-odol-harus-segera-dilaksanakan)  
- [Korlantas 协调稿](https://korlantas.polri.go.id/pemerintah-komitmen-sosialisasikan-strategi-penegakan-hukum-terhadap-kendaraan-truk-over-dimension-dan-overload/)  
- 媒体二次引用：[Kompas Otomotif 法律基础综述](https://otomotif.kompas.com/read/2025/06/09/151200015/dasar-hukum-dan-sanksi-buat-pelaku-odol)（WebFetch 曾 403，内容与 UU 条款一致处采信）

### 2.5 Zero ODOL 执法节奏（政策，不是新罚金表）

- **2025**：Menhub 明确「今年**不发新 ODOL 规章**」，而是**更严执行既有 UU 22/2009**；与 Korlantas / Jasa Marga 分阶段：sosialisasi → peringatan → penegakan；重点含 **pelabuhan、tol、工业区**；推进 WIM。  
- **目标年**：多方报道 **Zero ODOL 2027**（含 X 主流媒体帖）；2026 有「试验执法至 2027」转述。  
- **X / 标题党「Rp50 miliar / Rp50 M」**：媒体与 X 热帖出现（例：[CNBC Indonesia](https://x.com/cnbcindonesia/status/2105196446722953302)、[Harian Jogja](https://x.com/Harian_Jogja/status/2105569459163291836)）——**尚未核到对应 UU 条文写入该金额** → **待核实 / 勿写入 Port Pack 罚金字段**。  
- Baketrans Kemenhub 评论称现行 overload 罚金过轻，**建议**提高（含讨论 Rp50 juta 量级）——属政策建议，**非现行罚则**。

### 2.6 港口出门相关公开片段

- **Tol akses Tanjung Priok**：2017 报道五轴车总重上限约 **45 t**（PUPR/BPJT）——[Liputan6](https://www.liputan6.com/bisnis/read/2921553/kontainer-melebihi-45-ton-tak-boleh-lalui-akses-tol-priok)。**是否仍现行：待核实**。  
- **集装箱公路称重例外**：Permenhub 18/2021 对部分设施称重排除「angkutan peti kemas」等，但要求仍遵守 **JBI + 道路等级**，并附出发称重证明——**不等于可超载**。

---

## 3. VGM / CSC（海运侧 —— 部长规章）

### 3.1 现行规章

| 文件 | 状态 | 链 |
| --- | --- | --- |
| **PM 53/2018** | **已废止** | [JDIH Kemenhub](https://jdih.kemenhub.go.id/) / [BPK](https://peraturan.bpk.go.id/Details/102597/permenhub-no-53-tahun-2018) |
| **PM 25 Tahun 2022** | **现行**（2022-10-04 起；废止 PM 53/2018） | [JDIH](https://jdih.kemenhub.go.id/peraturan/detail?data=CXEkQHcG1lA3nJhtJQD3Fy4UptvQxfhhw8MOVkpzaLIo8glfHMQejH58QiPUsnmiSU4OdxTt0pap08MS8rlJtOoG4pHLlkqQUz84fXo7XijXNeAkGNwdG90ev67RlLzjbMuW7xK9Eq4wFmPBqgLEooipSh) · 条文整理：[pasal.id](https://pasal.id/peraturan/permen/permenhub-pm-25-2022) |

### 3.2 可产品化要点（PM 25/2022）

1. **Shipper** 负责确定并记录 VGM；可委托第三方。  
2. **无 VGM 信息 → 禁止装船**（Pasal 38）。  
3. Method 1（整柜称重）/ Method 2（分项累加）；秤须计量校准。  
4. 码头进闸复称：偏差 **&lt;5%** 可不换新 VGM 文件；**≥5%** → **禁止装船**直至新文件（Pasal 52）。  
5. **超过 CSC 铭牌最大毛重 → 禁止装船**（Pasal 53）。  
6. 一车两柜须**分别**称重，禁止「总重减车重再除以 2」。  
7. 行政制裁（对分类社/企业/Shipper 违规）：书面警告 ×3（各 15 工作日）→ 冻结 → 吊销——**不是对司机的 Rp 罚款表**。

### 3.3 承运人商业费（非行政罚）

- **Maersk Indonesia Weight Discrepancy Fee**：自 2020-06 起；**USD 300 / 柜**，若：SI 申报重与 VGM 差 **&gt;3000 kg**、或 VGM **&gt; CSC max gross**、或 VGM **&lt; tare**。[Maersk 通知](https://www.maersk.com/news/articles/2025/07/31/refresher-of-weight-discrepancy-fee-policy-indonesia)（WebFetch 曾 500，以官网为准）。  
- 其他船公司费率 **待核实**；Port Pack 应分 `admin_fine` vs `carrier_accessorial`。

### 3.4 码头实践

- **JICT（Priok）SOP（承运人公开 PDF）**：Gate-in / Gate-out 称重，系统记 VGM；**无 VGM 不可装船**。[Emirates Line SOP PDF](https://www.emiratesline.com/wp-content/uploads/2024/03/0042-Indonesia-SOP-For-Operation.pdf)。  
- 2016 Priok 港务/Syahbandar 联合通知：码头须具备出口重箱秤；显著差重可发新 VGM；**禁止一车双柜 combo**——[Bisnis.com 报道](https://ekonomi.bisnis.com/read/20160630/98/562824/tanjung-priok-terbitkan-4-pedoman-verifikasi-berat-kotor-peti-kemas)。

---

## 4. 检疫 / ISPM 15（装柜相关）

- 印尼对进口木包装执行 **ISPM 15**（去皮、IPPC 标记、指定入境检疫点等）。参考：Julius Kühn 汇编的印尼法规英译 PDF（[id_2009-12](https://pflanzengesundheit.julius-kuehn.de/mediaPublic/PG-docs/pdf/Vorschriften_Nicht-EU/G-J/Indonesien/id_2009-12_spwm_en.pdf)）；国内科普：[Badan Karantina Indonesia](https://karantinaindonesia.go.id/berita/jangan-anggap-sepele-kemasan-kayu-ada-standar-internasional-yang-harus-dipenuhi)。  
- **产品 checklist**：木托盘/木箱 → ISPM15 标记；无标记风险拒收/熏蒸/销毁（时限以检疫当局为准）。  
- 具体卢比检疫罚金：**待核实**（勿编造）。

---

## 5. Port Pack 字段建议（ID）

```yaml
country: ID
fine_profile: ID-ODOL-road
checks:
  - id: id_vgm_required
    severity: red
    ref: PM25/2022 Pasal38
  - id: id_csc_max_gross
    severity: red
    ref: PM25/2022 Pasal53
  - id: id_vgm_deviation_5pct
    severity: red
    note: "terminal reweigh ≥5% → no load until new VGM"
  - id: id_road_mst_class
    severity: red
    params: { class_I_mst_t: 10, class_II_mst_t: 8 }
  - id: id_jbi_vehicle_plate
    severity: yellow
    note: "require carrier KIR JBI/JBKI; do not invent tonnage"
  - id: id_odol_pasal277_307
    severity: info
    caps_idr: { pasal277_max: 24000000, pasal307_max: 500000 }
    disclaimer: "statutory caps; not a ticket calculator"
  - id: id_ispm15_wood
    severity: yellow
  - id: carrier_wdf_example_maersk
    severity: yellow
    amount_usd: 300
    type: carrier_accessorial
```

---

## 6. 仍薄 / 待核实

- [ ] 各省 / 各港门闸 **现行** 总重限值（Priok 45 t 是否仍有效）  
- [ ] Pelindo 统一 VGM 公差是否一律 5%（规章是；码头合同可能更严）  
- [ ] Zero ODOL 2027 **新罚金表**是否立法通过（X 上 Rp50 miliar 不可信作正式罚）  
- [ ] Belawan / Makassar / Semarang 码头公开 VGM SOP  
- [ ] 海关错报重量的行政罚金额度  
- [ ] 木包装拒收的标准卢比罚金  

---

## 7. 来源清单（本节）

见 `data/sources_catalog.yaml` 中 `jurisdiction: ID` 条目；X 样本见 `09_maritime_shipping_qa_experience.md` + `data/x_maritime_qa_sample.yaml`。
