<!-- #created 11/08/2026 -->
# 07 · 开源项目与开放数据

> as-of 2026-10-30 · 区分：**可结构化复用** vs **仅叙事参考**。注意许可证。

---

## 1. 港口 / 地点主数据（强烈建议接入）

| 资源 | 内容 | 许可/获取 | 用途 |
| --- | --- | --- | --- |
| [datasets/un-locode](https://github.com/datasets/un-locode) | UN/LOCODE CSV | 见仓库 | `port_id` 主键 |
| UNECE UN/LOCODE 官方发布 | 权威码表 | unece.org | 校验上游 |
| [NGA World Port Index](https://msi.nga.mil/Publications/WPI) | 全球港坐标、设施字段；CSV/GeoPackage 等 | 美国政府公开 | 地图/港属性 |
| WPI ArcGIS FeatureServer | 可查询图层 | services3.arcgis.com …/WPI | 程序拉取 |
| [SMDG Terminal Code List](https://smdg.org/documents/smdg-code-lists/smdg-terminal-code-list/) | 码头级代码（UN/LOCODE 子码） | SMDG | `terminal_id` |
| [bic-org/Facility-Code](https://github.com/bic-org/Facility-Code) | BIC 设施码 API/资料 | BIC | 堆场/设施 |

**复用：** `ports_index.yaml` 的 `unlocode` 应对齐 UN/LOCODE；终端用 SMDG/BIC。

---

## 2. 集装箱 / 运输标准数据

| 资源 | 用途 | 注意 |
| --- | --- | --- |
| ISO 668 / 6346 / GB/T 1413 / 1836 | 尺寸与箱型码 | 标准全文常付费；用国标平台摘要 + 船司 PDF 作 UX |
| OpenShipping.org 标准索引 | 行业标准导航 | https://openshipping.github.io/standards.html |
| VDA5050 GitHub | 舰队协议（非 stuffing） | 机器人附录交叉 |

---

## 3. 法规语料 / 合规 OSS

| 观察 | 结论 |
| --- | --- |
| 「柜内 stuffing 法规」开源语料库 | **公开检索未见**可直接灌入的全球港 stuffing 禁令数据集 |
| 各国运输部 HTML/PDF | 可自建爬虫+人工审；本知识库走**人工策展+URL**路径 |
| EU EUR-Lex、德 gesetze-im-internet、英 legislation.gov.uk | 欧英公路限值/罚则主键 |
| 中国：gov.cn / xxgk.mot.gov.cn / customs.gov.cn | 中国专章主键 |

---

## 4. 地理 / 港区

| 资源 | 用途 |
| --- | --- |
| OpenStreetMap harbour / industrial tags | 港区多边形粗定位；非法规 |
| 港口集团 Open Data（若有） | 个例；上海/鹿特丹等公开数据门户分批评估 |

---

## 5. 不建议当「法规源」的

- 货代自媒体「某港不能这么装」无链接帖  
- 仅厂商白皮书宣称的「符合某港要求」无条款号  
- 过期船司通知截图无日期  

---

## 6. 接入优先级（工程）

1. UN/LOCODE + 本库 `ports_index.yaml`  
2. 中国治超限值表（已结构化在 `02`/`05`）+ VGM 硬规则  
3. WPI 坐标（地图）  
4. SMDG 码头码（Phase2）  
5. 州/国罚金表示例缓存（人工 as_of）  
