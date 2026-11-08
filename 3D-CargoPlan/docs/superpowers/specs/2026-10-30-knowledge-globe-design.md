<!-- #created 11/08/2026 -->
# Knowledge Globe · 数据驱动地球仪设计

> as-of 2026-10-30 · CargoPlan / ClawHunt · 方案 **B**（用户已确认）

## 目标

独立静态 HTML：可旋转的 3D 地球仪，密铺千级集装箱相关 UN/LOCODE 港点；点开侧栏按时间线分层展示 **公约 → 国家 → 港 → 承运人费**。只展示已核实字段；薄港标薄。路演本地打开即可。

## 非目标

- 不控机、不编造港别 stuffing 禁令
- 不运行时联网拉 API（CDN 库可例外；知识 JSON 全离线）
- 不做罚单计算器

## 目录

```
/workspace/clawhunt/globe/
  index.html
  css/globe.css
  js/globe-app.js
  data/
    ports.json          # 千级港点
    countries.json      # 国别规则
    conventions.json    # L1 公约摘要
    port_packs/         # 深港 Port Pack JSON
    meta.json           # as_of / counts / disclaimer
  scripts/
    build_ports.py      # UN/LOCODE → ports.json
    build_countries.py  # 从 port-knowledge 抽国别包
README.md
```

同步到 Mac：`/Users/lege/Documents/ChatGPT/集装箱运筹/globe/`

## 数据契约

### ports.json（数组）

| 字段 | 说明 |
| --- | --- |
| locode | UN/LOCODE 5 位 |
| name | 英文名 |
| name_zh | 可选 |
| lat, lon | 度 |
| country | ISO2 |
| depth | `thin` \| `deep` |
| functions | 原始功能码摘要 |

来源：UNECE UN/LOCODE（或同等开放 dump），过滤有坐标且功能含港（1 / seaport）的条目；目标 **≥1000** 点。无法取得完整 dump 时：用公开子集 + 现有 `ports_index.yaml` 合并，并在 meta 标明覆盖。

### countries.json（按 country 键）

从 `02_china_national.md`、`02b_indonesia_national.md`、`05_fines` 等抽取：vgm、road_limits、fine_refs[]、sources[]、confidence、as_of。先厚 CN/ID；再扩 US/EU/SG/NL/AE/KR/MY 等 **骨架**（有出处才写金额）。

### conventions.json

SOLAS VGM、CTU Code、CSC、ISPM15、IMDG 高层要点 + 官方 URL（来自 `01_international_conventions.md`）。

### port_packs/{locode}.json

对齐 `08_port_pack_schema.md`；仅 deep 港（现有中国 8 + 全球已写分册 + 印尼五港）。

## 交互

1. 地球自动缓转；滚轮缩放；拖拽旋转
2. 点 = 港；deep 更亮/更大；按国别着色可选
3. 点击 → 右侧面板时间线手风琴：默认展开 **国家**；其余折叠可开
4. 搜索框：locode / 港名 / 国家
5. 页脚 disclaimer + as_of + 点数

## 诚实 UX

- 缺层：`待核实` / `薄`
- 罚款区间必须带 source URL
- 承运人费标注「商业条款 ≠ 行政罚」

## 验收

- [x] 本地 `npx serve globe` 或 `python -m http.server` 可开
- [x] ports ≥ 1000（或 meta 诚实说明实际数）
- [x] 点 CNSHA / IDTPP 能看到国别+港层内容
- [x] Mac 路径已同步


## 2026-10-31 落地补充

主站与独立静态版已共享 `src/knowledge/globe/`，独立版输出 `globe/dist/`；当前入口不使用 CDN 或在线纹理。22 标为已建知识包，保留 thin/stub 等待完善状态。新增本地陆地轮廓、来源核对记录、中文检索、国家/知识包过滤与可阅读整理分册。验收和边界详见 `docs/KNOWLEDGE_GLOBE_DELIVERY.md`。本次独立预览使用 8766，8765 已被其他服务占用。
