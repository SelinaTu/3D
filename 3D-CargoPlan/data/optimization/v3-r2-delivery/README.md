<!-- #created 11/08/2026 -->
# 第二轮冻结完整方案

`current-best.json`是唯一当前交付输入。11柜1371件、零遗漏，尾柜35.58199734m³，前十最低模型实体利用率66.2184621241%。与上轮36.71675418m³及65.1471977563%相比，两项均改善，冻结合同和全部规则未改。

结果SHA256：`fa4fa9261fdcc0c7e1a852eb3455299f2e268695d9690a379e950058c68014d5`。
物理布局指纹：`edfee104844d2e8230c1417bd1eda12673b8268596691527342b09663375ac82`。

`final-audit.json/.md`独立重新加载冻结合同、权威清单和布局，14项检查全部通过；没有直接采用结果内置valid标志。没有新增木件、未改变箱型或孔内规则，24长框宏的失败全量分支也没有混入本解。

本目录其他JSON是回放/合并的中间节点，未作为当前交付；完整原文件保存在本机工作目录及第二轮归档。

```sh
node --import tsx src/scripts/accept-v3-r2-independent.ts data/optimization/v3-r2-delivery/current-best.json final
node scripts/build-static-report.mjs data/optimization/v3-r2-delivery/current-best.json output/reports/iraq-villa-current-best.html
node scripts/export-static-report.mjs output/reports/iraq-villa-current-best.html
```

具体动作及负结果见[第二轮复盘](../../../docs/OPTIMIZATION_ROUND2.md)，完整归档恢复方式见[计算记录说明](../README.md)。当前结果依赖既定几何/投影载荷假设，不代表现场承托和运输动力学验收，也不构成全局最优证明。
