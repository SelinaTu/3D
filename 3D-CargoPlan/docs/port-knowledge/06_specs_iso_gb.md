<!-- #created 11/08/2026 -->
# 06 · 集装箱规格（ISO / GB）

> as-of 2026-10-30 · 产品用**额定/最小内部尺寸**做可行性；实际可用容积因厂家波纹/地板而异 → UI 标注「名义/最小」。

---

## 1. 主键标准

| 标准 | 内容 | 链接 |
| --- | --- | --- |
| ISO 668:2020 | Series 1 分类、尺寸、额定质量 | ISO 商店；摘要见公开样本 |
| ISO 6346 | 代码、识别和标记（箱型代码） | BIC / ISO |
| ISO 1496-1 等 | 技术要求与试验 | |
| **GB/T 1413-2023** | ≡ ISO 668:2020；2023-07-01 实施 | [国家标准平台](https://std.samr.gov.cn/gb/search/gbDetailedCNF?id=F78920661043B223E05397BE0A0AE533) |
| **GB/T 1836-2017** | ≡ ISO 6346:1995 IDT | 国家标准馆等 |
| 交通运输部《集装箱标准体系》 | 国标/行标索引 PDF | https://xxgk.mot.gov.cn/2020/jigou/kjs/202405/P020240507353162099354.pdf |

宽度统一叙事：系列1 外宽 **2438 mm**。额定质量上限公开叙述可达 **36000 kg**（特殊运输须测试标记；见 GB/T 1413 文本转载）。

---

## 2. 常用柜型（ISO 最小内部尺寸 · 行业常用对照）

> 下列最小内部尺寸来自 ISO 668 公开摘要（20GP=1CC，40HQ=1AAA）。**实际柜以箱体标称为准。**

| 俗称 | ISO 型 | 外长×高（约） | 最小内长 mm | 最小内宽 mm | 最小内高 mm | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 20GP | 1CC | 20′×8′6″ | 5867 | 2330 | 2261 | 门洞最小约 2261×2134 |
| 40GP | 1AA | 40′×8′6″ | 11998 | 2330 | 2261 | |
| 40HQ | 1AAA | 40′×9′6″ | 11998 | 2330 | 2566 | 高箱 |
| 45HQ | 1EEE 等 | 45′×9′6″ | 见标准表 | 2330 | 见标准 | 国内/航线可用性核对 |

箱型代码示例（ISO 6346）：`22G1`（20 通用）、`45G1`（40 高箱）等——以箱门与 BIC 码为准。

---

## 3. 承运人公开规格书（二次 · 实用）

船司 Container Specification PDF（Hapag-Lloyd 等）给出**典型**内尺寸与载荷，便于 UX 默认值；与 ISO **最小**值可能不同 → 字段分 `iso_min` vs `carrier_typical`。

例：https://www.hapag-lloyd.com/content/dam/website/downloads/press_and_media/publications/15211_Container_Specification_engl_Gesamt_web.pdf  

---

## 4. CSC 铭牌

最大营运总质量、堆码、检验日期/ACEP — 装载校验：`cargo + tare ≤ max_gross`。  
IMO CSC：https://www.imo.org/en/about/conventions/pages/international-convention-for-safe-containers-%28csc%29.aspx  

---

## 5. 产品字段建议

```yaml
container:
  iso_type_code: "45G1"
  external_lwh_mm: [12192, 2438, 2896]  # example HQ
  internal_source: iso_min | carrier_typical | measured
  tare_kg: 3900
  max_gross_kg: 30480
  payload_kg: 26580
```
