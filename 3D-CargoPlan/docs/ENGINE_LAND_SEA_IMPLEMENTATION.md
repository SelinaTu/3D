<!-- #created 11/08/2026 -->
# 海陆三维装配引擎：当前落地范围

本轮建立共用求解与校验基础，尚未达到 EasyCargo 或装箱大师的完整功能覆盖。陆运车辆与海运箱体都以实际内尺寸、额定载重定义；每次计算目前只支持一种车辆／箱体规格。单位为 mm、kg。

## 已有能力

- 贪心 FFD/BFD 与其他启发式搜索，逐件放置，输出坐标、方向、重量、利用率及未装载清单；方案经独立校验。候选方案比较先按未装载件数、再按车辆／箱数比较，无法证明全局最优。
- 长方体，及有贯通矩形空腔的框体；空腔按实体壁计算，允许通过货物分类 `allowedCategories` 或历史来源表 `allowedSourceSheets` 授权内容，两类条件为“或”。实际可否嵌套仍受碰撞、间距、支撑和方向约束。
- 圆柱、卷材、管材可声明形状，但仅按防滚包装长方体外包计算。`dimensions` 必须是含包装尺寸，`packaging.envelopeConfirmed` 和 `packaging.antiRoll` 均为 `true` 才能装载。否则放进未装载清单并写明待确认事项；包装外包体积不等于货物实体体积。
- 六种正交尺寸方向；可以单独限定水平旋转 0、90、180、270 度。方向名的默认竖直轴分别为 standing=原高、lying=原宽、flat=原长，可显式映射。
- 载重、顶载、叠层件数、可叠放对象、落地、承托、重心、允许与禁止方向，以及同组专箱约束。`onlySameMixGroup` 启用时本柜内每件货物都必须有同一个非空 `mixGroup`，双向生效；它不要求同组货必须都在同一柜。
- 自定义 `clearanceMm` 为货物间三轴最小间距；该模型不假定隔垫传力，间距为正时不能直接接触叠放。箱壁间距、装卸操作净空并未由此定义。伊拉克 PDF 专项口径和历史玻璃架例外继续独立保留。
- 可选卸货站序 `unloadStop` 和车门端 `unloadingDoor`（`x-min` / `x-max`）。启用时每件货都需填写正整数站序；数字小的先卸。每个候选按未装数量、车辆数、跨站潜在阻挡对数、其他评分依次比较。贪心对体积优先与站序优先各生成候选，其他搜索也以这一顺序比较。
- `unloadAnalysis` 按车门方向的直线外包投影，以及上方直接支撑，列出更晚卸货物造成的潜在阻挡对。它不计算同站内部可卸顺序、间接依赖、移走与放回过程、门洞、设备或运动路径；阻挡对数不等于实际倒货次数。必须假设所有货从起点在车上，中途取货尚不支持；零阻挡不代表可以安全卸货。五站模拟演示位于“海陆样例”中的“真实求解器演示”。

## API 使用

`POST /api/optimize` 返回 202 和 `jobId`；通过 `GET /api/jobs/:id` 获取状态及结果。现有服务接口要求每件货唯一 ID 且 `quantity: 1`，批量数量须在提交前展开；程序内部调用可使用正整数数量。示例货物：

```json
{
  "id": "coil-1", "name": "已包装钢卷", "category": "钢卷",
  "shape": "coil", "dimensions": {"length": 1200, "width": 1100, "height": 1100},
  "packaging": {"envelopeConfirmed": true, "antiRoll": true},
  "weight": 800, "quantity": 1, "allowedOrientations": ["standing"],
  "canStackOnTop": false, "canOffsetStack": false, "hasGlass": false,
  "colorTag": "blue", "rawData": {},
  "constraints": {"horizontalRotations": [0, 180], "mixGroup": "金属", "onlySameMixGroup": true}
}
```

请求的 `config` 可指定 `containerDimensions`、`containerMaxWeight`、`loadingProfile: "custom"`、`clearanceMm`、`algorithm: "greedy"`、`timeLimit`；未指定的其他参数由服务使用默认配置补齐。空腔定义示例：

```json
{"dimensions":{"length":800,"width":600,"height":100},"offset":{"x":100,"y":100,"z":0},"allowedCategories":["配件"]}
```

空腔必须在外包内，至少一个轴完全贯穿；坐标使用货物未旋转时的原始坐标，空腔授权不能为空字段集合，空列表表示不允许该来源／分类。

## 明确尚未完成

1. 车门尺寸与可到达性、装卸设备和操作净空、轴荷、运输动态稳定性、系固设计及相关法规核验；现有几何校验通过不等于可以安全发运。
2. 中途取货、完整卸货顺序、临时倒货与装卸成本的建模；本期不计算路线。当前不会声称已有面向多站的可执行装卸顺序。
3. 混合车型联合选型、精确曲面或任意多面体碰撞、任意异形货、托盘化、手动拖放与锁定后重算、现场任务单／机器人协议。
4. 将新字段接入 Excel 模板和可视化编辑流程；当前新能力可由 API 和 TypeScript 数据使用，现有前端页面尚不能完整编辑这些字段。

历史测试快照并非可运行源码，`npm test` 排除 `data/**`，仍运行项目正常源码中的全部测试。
