<!-- #created 11/08/2026 -->
# 上海港 Shanghai (CNSHA)

> as-of 2026-10-30 · confidence: mixed primary + official_secondary

## 标识
- **P0** · ~51.5 m TEU (2024 Lloyd's) · 中国出口旗舰
- 港区集群：外高桥 / 洋山等（terminal_cluster）
- 港务：上港集团 https://www.portshanghai.com.cn/

## 已核实 / 强线索
| 主题 | 内容 | 源 | confidence |
| --- | --- | --- | --- |
| VGM | 全国 SOLAS + 部委执行；洋山侧重量验证智能监管、全域监管公开报道 | MOT VGM 通知；[上海海事局媒体](https://www.sh.msa.gov.cn/mtbd/87299.jhtml)；[中国港口网](https://www.chinaports.com/portlspnews/15734) | official_secondary |
| 容差叙述 | 行业/船司常用「±5% 或 1 t 取小」与海事执法口径叙述并存 | 船司本地指引；部令 PDF 转载 | unverified→核对现行规章 |
| No VGM No Load | 外贸装船条件；码头侧常见 | SOLAS + 行业实践 | primary (公约) |
| 海关 | 适用全国集装箱检验检疫/查验/申报 | `02_china_national.md` | primary |
| 公路 | 出港集卡适用全国治超第 3/43 条 | gov.cn 治超全文 | primary |

## 未见 / 待核实
- 未见机器可读「上海港禁止某柜内摆法」规章。
- 各码头 VGM cutoff 时刻表（多在船司/EDI）→ 待核实。
- 洋山自动化堆场 ≠ 柜内机器人法规。

## Port Pack stub
```yaml
port_id: CNSHA
fine_profile: CN-road
checklists:
  - id: vgm_before_load
  - id: customs_packing_list_align
  - id: ispm15_if_wood
  - id: road_gross_mass_vs_axles
vgm_policy: no_vgm_no_load
customs_photo: true
as_of: "2026-10-30"
```
