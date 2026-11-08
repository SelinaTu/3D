<!-- #created 11/08/2026 -->
# 3D CargoPlan Knowledge Globe

数据驱动 3D 地球仪知识库（方案 **B**）· as-of **2026-10-31** Asia/Shanghai · knowledge **v1.2.2**

双层：
- **基础 Foundation**：点港 → 公约→国家→港→承运人费（L1–L4）
- **关注 Attention**：主题知识包（D&D、VGM、ODOL、甩柜、运价黄灯…）— 详尽定义/FAQ/官方出处；热度只排序

## 打开方式

必须用本地 HTTP 服务（`file://` 下 `fetch` JSON 会被浏览器拦）：

```bash
cd globe   # 或本目录
python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/
```

顶栏切换 **基础 | 关注**；点港侧栏有 Related topic chips；搜索支持 locode / 港名 / 主题。

也可：`npx --yes serve -p 8765 .`

## 目录

| 路径 | 说明 |
| --- | --- |
| `index.html` | 入口（CDN：three.js + globe.gl） |
| `css/globe.css` | 深色工业风 + lime + attention chips |
| `js/globe-app.js` | 地球 + 搜索 + L1–L4 + 关注层 |
| `data/ports.json` | UN/LOCODE 海港点 |
| `data/countries.json` | 国别规则 |
| `data/conventions.json` | L1 公约摘要 |
| `data/port_packs/*.json` | 深港 Port Pack |
| `data/topics/*.json` | **关注层**主题包 + `index.json` |
| `data/meta.json` | as_of / 点数 / topic_count / gaps |
| `scripts/build_ports.py` | 重建 ports.json |
| `scripts/build_countries.py` | 重建 countries.json |
| `scripts/build_topics.py` | 重建 topics JSON + docs encyclopedia |

百科镜像：`../docs/port-knowledge/topics/`

## 诚实边界

- 薄港只显示坐标 +（若有）国别；不编造柜内 stuffing 禁令
- 罚款区间必须带来源 URL；承运人费标注 **commercial ≠ administrative fine**
- 关注层金额不以 X 为裁判；`rumor_unverified` 显式标记
- 详见 `data/meta.json` → `gaps`

## 设计

`../docs/superpowers/specs/2026-10-30-knowledge-globe-design.md`

## 1.2.2 知识升级

加入 90 天分期趋势附篇，数据为封顶检索样本，不能代表全网份额；来源及方法见 `../docs/port-knowledge/12_x_attention_trend_90d.md`。港口清单仅在来源文件指纹核实后附证据指针，适用性仍待核验；不作自动裁决。
