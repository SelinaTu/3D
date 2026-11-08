<!-- #created 11/08/2026 -->
> **当前 Mac APP 开发交接请先读 [CURSOR_HANDOVER.md](CURSOR_HANDOVER.md)**，更新于 2026-10-31。下文为 10 月 18 日算法与网页专项历史交接，不代表当前 APP 功能全貌。

# 项目接管说明 · 更新至 2026-10-18

最新 PDF 校准专项第二轮已达到完整 11 柜实质缩尾：1371 件、零遗漏；尾柜 35.581997 m³，前十瓶颈 66.218462%，均进一步优于上轮及原 PDF 同口径指标。本轮合同、冻结结果、复验命令及边界见 [docs/DELIVERY_V3.md](docs/DELIVERY_V3.md)，完整计算分支见 [第二轮复盘](docs/OPTIMIZATION_ROUND2.md)及[计算总复盘](docs/OPTIMIZATION_V3_RECAP.md)。以下为原工作台接管模块说明，旧箱型结果不用于本轮 PDF 比较。

当前维护路径：`/Users/lege/Documents/ChatGPT/集装箱运筹`。原项目 `/Users/lege/Projects/cargoplan` 只读接入并保留原样。交付结论与验收证据见 [DELIVERY_REPORT.md](DELIVERY_REPORT.md)。

## 已完成

- 修复无法构建、fake 7柜演示、kg/百分比单位混用、坐标轴不一致和数据硬编码路径。
- 全量读取三表1371件；动态表头、数量展开、源行追踪和严格错误提示。
- 真实 FFD/BFD、遗传、禁忌、蚁群、混合及有界分支搜索，统一物理约束与独立校验。
- 独立计算线程、进度查询、取消、输入边界和任务过期处理。
- 自适应工作台、实例化3D、俯视图、选柜、货物定位、逐件明细、重心展示。
- JSON、Excel、HTML/打印PDF导出；真实报告及逐件可复核清单。
- 锁定并修复依赖；当前生产构建、146项回归通过，保留此前生产API全量验收。

## 模块职责

| 路径 | 职责 |
| --- | --- |
| `src/App.tsx`, `src/app.css` | 数据/配置/任务/比较/导出的操作界面 |
| `src/components/ContainerViewer.tsx` | 实例化货物、坐标转换、重心、交互 |
| `src/store/` | 状态生命周期和防旧方案残留 |
| `src/types/packing.ts` | mm / kg、物品、摆放、方案和配置契约 |
| `src/core/data-parser.ts`, `xlsx-adapter.ts` | 浏览器及Node Excel兼容、约束归一、源行定位 |
| `src/core/packing-utils.ts` | 方向、边界、碰撞、支撑和累计载荷 |
| `src/core/greedy-algorithm.ts` | 数量归一、候选点解码、FFD/BFD |
| `src/core/*algorithm.ts`, `tabu-search.ts`, `ant-colony.ts`, `branch-bound.ts`, `search-utils.ts` | 真实有界搜索与共享可行基线 |
| `src/core/optimizer.ts` | 调度、时限、比较、默认参数 |
| `src/core/validation.ts`, `evaluator.ts`, `solution-builder.ts` | 独立原清单校验、指标、构造和排序 |
| `src/core/export-utils.ts`, `report-generator.ts` | 文件导出、报告转义、无虚构成本 |
| `src/server/` | HTTP API、请求校验、worker生命周期与本机静态服务 |
| `src/scripts/` | 数据重生、CLI、生产验收 |
| `data/` | 完整原Excel、全量JSON、历史子集和来源说明 |
| `scripts/build-server.mjs` | 可直接用Node启动的服务端/worker构建 |
| `docs/API.md`, `README.md` | 当前运行与接口说明 |
| `docs/archive/` | 旧交接及旧静态页，不能作为当前能力承诺 |
| `Dockerfile`, `compose.yaml`, `.github/workflows/check.yml` | 可复现部署与检查配置 |

`packer.ts`、`constraint-system.ts` 为兼容入口，已对齐物理引擎。`demo-solution.ts` 调用真实贪心，不再构造固定七柜。`sandbox-learning.ts` 不是当前操作流的功能，不承诺自动学习成效。

## 继续开发的边界

1. 减柜质量：本轮已使用确认空腔、联合承托宏和全量跨柜迁移，在11柜内改善尾柜与前十瓶颈；后续可继续减少尾柜或尝试10柜。当前没有全局最优证明。
2. 工程复核：静态几何与载荷模型之外的包装强度、绑扎、动力载荷和箱体实测规格需要现场确认。
3. “尽量靠柜门”保留为软偏好、未纳入优化；可增加装卸顺序和门侧定义后实现。
4. 本机工作台已交付；公网/多用户部署需明确主机、身份认证和数据持久化设计。本次没有发布到外部服务。
5. Docker运行需要可用daemon；当前环境未启动，不能将配置文件存在当作容器验收通过。

所有修改应通过 `npm run check`，生产集成通过 `npm run acceptance`。历史原报告归档于 `docs/archive/PROJECT_HANDOVER.md`，其中“已提交Git”“算法已完成”“7柜”等表述已经实际审计纠正。
