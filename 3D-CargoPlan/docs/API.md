<!-- #created 11/08/2026 -->
# 本机 API · v1.1.0

默认地址 `http://127.0.0.1:3001`。所有错误为 `{ "success": false, "error": "可读说明" }`，请求 JSON 上限 20 MB。

## GET /api/health

返回 `{success:true,status:"running",version:"1.1.0",busy:false}`。优化在独立 worker 运行，此端点在计算时仍可响应。

## GET /api/config

返回 `{success:true,config:OptimizationConfig}`。默认内尺寸 `12032×2352×2698 mm`，额定载重 `28000 kg`，时间预算 `30000 ms`。

## GET /api/load-demo

返回 `{success:true,data:CargoItem[],total:1371,message:string}`。读取项目随附三表全量数据，不依赖个人笔记路径。

## POST /api/optimize

提交异步任务，成功状态 **202**，返回 `{success:true,jobId:string}`。

```json
{
  "items": [
    {
      "id": "box-1", "name": "纸箱", "category": "箱",
      "dimensions": {"length": 600,"width": 400,"height": 300},
      "weight": 12.5,"quantity": 1,
      "allowedOrientations": ["standing"],
      "canStackOnTop": true,"hasGlass": false,"canOffsetStack": false,
      "colorTag": "蓝色","rawData": {}
    }
  ],
  "config": {"algorithm": "compare","timeLimit": 30000}
}
```

配置可部分提交，其余使用默认值。支持 `greedy / genetic / tabu / ant-colony / branch-bound / hybrid / compare`。`compare` 对比 FFD、BFD 和五种搜索变体，共用总预算。`timeLimit` 范围 1000–120000 ms，`populationSize` 为 2–100，`generations` 为 1–500。

输入应为 1–5000 个单件，`quantity` 必须为 1 且 ID 唯一；Excel 解析器已自动展开数量。尺寸为有限正 mm，重量为有限非负 kg。超尺寸或业务约束不允许装载的货物会进入未装清单，不会丢弃。无效数据返回 400；已有任务运行返回 429，附 Retry-After: 2。

可选约束：`forbiddenOrientations`、`maxStackWeight`（上方累计 kg）、`maxStackCount`（上方累计件数，不含本件）、`stackableWith`、`orientationVerticalAxes`。`constraints` 可包含 `mustBeOnFloor`、`supportedItemsLargestFaceDown`、`orientationRules`、`requiresManualReview`。带人工复核标记的物品不自动装入。

通用方向默认 `standing` 原 H 竖直、`lying` 原 W 竖直、`flat` 原 L 竖直；门窗源数据通过逐件 `orientationVerticalAxes` 映射为 standing:L / lying:W / flat:H。`rotation` 是摆放后的水平旋转。最终占用尺寸以 `actualDimensions` 为准。

## GET /api/jobs/:jobId

```json
{
  "success": true,
  "id": "任务UUID",
  "status": "running",
  "progress": {"progress": 14.3,"algorithm": "GENETIC","message": "正在执行 GENETIC"},
  "createdAt": "2026-10-16T05:00:00.000Z"
}
```

状态为 `queued / running / completed / failed / cancelled`。完成附 `solutions: PackingSolution[]` 和 `finishedAt`；失败附 `error`。建议每 650–1000 ms 查询一次，取消/完成后停止。任务不存在或过期返回 404；最近 5 个已完成任务最多保留 30 分钟，均为进程内存状态。

方案包含：`containers`、`totalItems`（输入总件数）、`unpackedItems`、利用率（0–1）、计算耗时 ms、`validation:{valid,errors,warnings}`、`searchMode`、`terminationReason` 和 `notes`。`stats.placedItems` 是已装件数；`valid:true` 说明已建模约束与记账一致，不等同于无未装件数或全局最优。

每件已装货物含原始 `item`、`position:{x,y,z}`、`orientation`、`rotation`、`actualDimensions`。坐标 x=长、y=宽、z=高，单位 mm；每柜附实际重量 kg、利用率及 `centerOfGravity`。

## DELETE /api/jobs/:jobId

取消任务并终止计算线程，返回 `{success:true,status:"cancelled"}`。若已完成则返回原状态，完成结果仍可查询。不存在返回 404。

## 导出

浏览器使用 `src/core/export-utils.ts` 生成 JSON、四表 Excel 和自包含 HTML；HTML 可打印为 PDF。导出不依赖服务端全局“最近结果”，避免方案串用。旧 SSE、模拟服务器控制、服务端全局对比报告接口已移除。
