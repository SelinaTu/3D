<!-- #created 11/08/2026 -->
# 多站点装卸引擎与 3D 播放器

更新：2026-10-31。多站点保留手工输入业务需求和自动随机出题两个入口，所有输入共用同一求解引擎。用户明确要求保留自动出题用于演示，不得在后续改版中删除或替换成预制答案。

1.7.2 当前默认：与 HTML 共用伊拉克完整基线（11 柜 / 1371 件），可从中选一柜完整参与多站演示。默认第 1 柜 93 件；八件小样例保留为可选练习，不再作为默认数据。见 `NATIVE_APP_172_IRAQ_DEMO.md`。

1.7.1：APP 顶部「自动出题演示」默认使用独立演示车辆，不要求先完成当前装配重算；出题后主动计算并查看 3D 播放。选择当前装配货柜时仍保留 dirty 校验，避免用过期布局。见 `NATIVE_APP_171_DEMO_FIX.md`。

## 直接体验

网页工作台或原生应用的「多站点作业计划」：

1. 起点选择当前装配货柜或空车，新增、命名及调整站序。
2. 选择站点，按货物类型填写卸货件数；添加取货规格/件数和后续交付站。
3. 设置人员作业方式、通道宽度/净高及触及距离，可启用出发前靠门重排。
4. 点击「计算装卸方案」，进入执行视图，逐站核对完成与未完成需求，播放装卸及临移/放回动画。
5. 导出输入计划和执行记录，之后可导入重算。「随机出题」保留站点数、随机种子、示例类型、生成题目和换一题；生成后使用同一主动求解与 3D 播放流程。高级 JSON 编辑另行保留。

参数修改不会自动计算。出发前重排保留全部货物和同一货舱，无法构造合规改善候选时保留原布局，记录原因，不用丢货换装载率。

## 人员可达与限制

`handling` 是计划中的可选作业配置；界面新建和导入缺省配置时使用工人模式：

```json
{"mode":"worker-aisle","aisleWidthMm":600,"aisleHeightMm":1800,"reachMm":800,"maxReachHeightMm":2100}
```

模式包括工人进舱、仅门外取货 `door-only`、设备抽取 `mechanical`。后者明确不校验人员可达。数值均为可编辑的规划假设，非人体工学认证。底层旧 v1 计划省略配置时保留历史几何语义；界面会补入人员配置，避免在实际操作中静默沿用旧假设。

工人模式同时检查门向抽取投影、承托、从门口连通的地面站立区域、净高、接近取货面的水平距离和手部取货高度。地面走道按方形占位膨胀障碍，再做网格洪泛与边扫掠检查，不能穿越薄障碍、矮货墙或过窄缝隙。不模拟攀爬、复杂侧身、人的姿态、抓握力、搬运负荷或抓取/设备轨迹；空腔按保守外包处理。全路径可达性属于离散模型筛查，不代表现场安全认证。

早卸货物优先水平靠门。出发前优化按站序划纵向区，完整装入并通过原装配规则校验后，比较人员可达和距门评分；不会为了优化更换货舱或减少清单数量。途中新装按交付先后选择近门/深处候选，临移仍事务化回滚，不能完整放回则不提交。

## 可复用接口

入口：`src/core/multistop/index.ts`，没有 React、Three.js、DOM 或 Worker 依赖。

```ts
import { generateRouteProblem, solveRoute, auditSimulation } from './src/core/multistop/index'

const problem = generateRouteProblem(container, {
  stopCount: 5, seed: 20261030, door: 'x-max', mode: 'feasible'
})
// 之后更换题目只替换 problem，直接来自文件或其他系统也可以。
const result = solveRoute(problem, console.log, { perStopTimeLimitMs: 8000, repackInitial: true })
const errors = auditSimulation(result)
```

| 模块 | 职责 |
|---|---|
| `model.ts` | 题目、站点、结果、动作和求解设置类型 |
| `problem.ts` | JSON 格式、货物参数、起点几何、ID 流转与目的站校验 |
| `access.ts` | 人员连通通道、净高、触及距离与高度；导入参数校验 |
| `planning.ts` | 各站计划库存、出发前靠门分区候选与整批守恒 |
| `src/demo/RouteComposer.tsx` | 手工站序、卸货数量、取货规格与目的站表单 |
| `scenarios.ts` | 随机出题；仅产生题目数据 |
| `engine.ts` | 按任意站序依次卸货、联合解阻、有限倒货、寻找装货位置；失败事务回滚 |
| `replay.ts` | 独立逐步重放，核对库存、通道、承托、尺寸和站点快照 |
| `playback.ts` | 将求解结果转换为到站/作业时间线和展示帧 |
| `src/demo/RoutePlayer.tsx` | 播放控制与视觉标记；不参与求解 |
| `src/demo/simulation-worker.ts` | 将生成和求解放入后台线程，支持取消 |

保留旧 `simulateThreeStops` / `simulateFeasibleThreeStops` 作为历史脚本兼容入口；它们只把三站参数交给通用引擎，新页面不使用这些旧入口。

## 题目格式 v1

```json
{
  "schema": "cargoplan.route-problem/v1",
  "seed": 42,
  "door": "x-max",
  "initial": {
    "id": "demo-truck",
    "dimensions": {
      "length": 4000,
      "width": 2100,
      "height": 2200
    },
    "maxWeight": 1000,
    "items": [],
    "totalWeight": 0,
    "volumeUtilization": 0,
    "weightUtilization": 0
  },
  "stops": [
    {
      "name": "仓库取货",
      "unloadIds": [],
      "pickup": [
        {
          "id": "box-001",
          "name": "设备箱 A",
          "category": "木箱",
          "dimensions": {
            "length": 600,
            "width": 400,
            "height": 300
          },
          "weight": 10,
          "quantity": 1,
          "allowedOrientations": [
            "standing"
          ],
          "canStackOnTop": false,
          "canOffsetStack": false,
          "hasGlass": false,
          "colorTag": "#168766",
          "rawData": {}
        }
      ]
    },
    {
      "name": "客户交付",
      "unloadIds": [
        "box-001"
      ],
      "pickup": []
    }
  ]
}
```

上面的完整示例保存在 `examples/multistop/collect-and-deliver.problem.json`。伊拉克整柜五站题位于 `output/validation/multistop-engine/iraq-bin1-five-stops.problem.json`。

- `initial` 可以是空车，仍需有效内尺寸、额定载重；非空起点必须通过装载校验。
- `unloadIds` 只能引用起点在车单件，或之前站点计划提货的单件。未知 ID、提货早于来源站、重复交付和重复货物 ID 都会拒绝。
- `pickup` 使用项目完整 `CargoItem`，每件 `quantity=1`，包含唯一 ID、名称、分类、尺寸 mm、重量 kg、方向、堆叠等约束。可以跨多个站运输，不要求下一站卸。
- 实际目的站由 `stops[].unloadIds` 推导，在复制后的题目上绑定；输入原件不被修改。
- 上一站提货失败会记为后站的未完成交付，不会生成不存在的卸货动作。错过本站的交付不会擅自改派其他站。
- `pickupPlacements` 是可选、仍需验算的装货候选。随机可行题会携带候选以复用已知空槽；编辑任务时会移除这些候选，由引擎按新要求搜索。它不是绕过约束的固定坐标。

结果含各站需求、实际在车待卸、完成/受阻卸货、完成/失败装货、上游未提货、原因、临时倒货、逐步操作和站后完整快照。操作类型是 `unload`、`temporary-out`、`pickup`、`return`。

## 不开网页也可解题

```sh
node --import tsx scripts/solve-route.mjs \
  output/validation/multistop-engine/iraq-bin1-five-stops.problem.json \
  /tmp/five-stops.result.json
```

输入换成任意符合格式的新题目即可。该命令输出每站进度、完整结果和未完成需求数；格式错误和校验失败返回非零退出码，未完成需求会留在结果里，不被冒充完成。

## 本轮验收

- `npm run check`：28 个测试文件、208 项测试，ESLint、TypeScript 和生产构建通过。
- 新增 17 项引擎/播放回归，覆盖 1、2、5、8、12 站和两种开门方向、空车取货、隔站交付、无作业站、保存导入重算、错误 ID、起点碰撞、动画端点、中间平移方向及输入不被修改。
- 伊拉克 11 个历史柜 × 2/5/8 站 × 两种开门方向：66/66 可行题全部完成并通过独立重放。记录：`output/validation/multistop-engine/acceptance.json`。这不代表任意随机题都能求解。
- 浏览器生成五站整柜题、求解通过；模型序号点击正确，卸货 50% 时 X 从 10570 移到 11265.25 mm；4 倍速全程从站 1 连播到站 5，33/33 段后正常结束。
- 在浏览器直接编辑 JSON，追加第六站交付此前在末站提货的两件货，没有修改代码，六站全部完成。导出后再用 CLI 独立重算同样为零未完成项。题目与结果保存为 `browser-edited-six-stops.problem.json` 和 `browser-edited-six-stops.result.json`。
- 补货测试发现并修复：倒货时如果新货总是先占门口，临时移出货物会无处放回。现在先尝试保留倒货的原空间，再搜索装入，仍须完整放回才提交事务。

## 边界

本轮是单车、既定站序、正交装配与沿车长直线进出引擎；不是道路路线规划，也未新增全局多车多站调度。搜索有时限，失败不代表已证明无解。动画中途仅作展示，稳定端点和动作通道来自校验记录；机械抓取、机器人连续轨迹、门洞、绑扎和真实临时堆放区条件未验证。伊拉克历史起点继续采用已声明的 PDF 承托投影与 W02 高度例外。
