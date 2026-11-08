<!-- #created 11/08/2026 -->
# 原 PDF 第 8、9 柜局部复盘

本记录保持 `data/reconstruction/model-v2-contract.json`：原 PDF 净空、5 mm 实体预留、已声明投影传载、80% 工程支撑面积、重心凸包及全部源表载荷/朝向限制。每柜 `sourceIds` 不变，未跨柜。以下均为 **partial**，不构成原 11 柜基线完整复现。

**后续解析结论：** 第 8 柜在上述固定 v2 条件下已得到条件不可行证书，见 `container-eight-v2-certificate/PROOF.md` 与 `certificate.json`；停止该模型下搜索。下文第 8 柜为得出证书之前的历史实验记录，不是继续搜索计划。证书依赖 80% 工程下限，不评价原 PDF 现场或其他配货方案。

## 第 8 柜：104 / 105，独立校验有效

- 结果：`delivery-output/reconstruction/pdf-eight-maxrects/result.json`。唯一未装：`门窗:W07:r9:u25`，允许可用侧放尺寸 3030 × 120 × 2030 mm。
- 结构：13 件 W06 扇侧放共同承托 7 件同源平放扇；平放底面投影满足 80%，单个侧放底件累计顶部载荷仍小于 120 kg。两件 1530 mm 高的 W03 位于平桥侧向悬出区下方，其顶面距桥底 59.5 mm，不承担桥载。
- 18 件 W05 全部按获准 `lying` 方向放入 W02 框空腔；未用额外窗面内旋转。
- 原始二维候选见 `best-2d-partial.json`，之后真实逐件展开调用公共 `canPlaceAt`，并以原柜全部 105 IDs 与 config 调用 `validateSolution`。当前 `validation.valid=true` 且 `complete=false`。
- 局部修补枚举 990 个 W07 目标位置，每位置最多移动 6 个宏矩形，正反/面积/20 个确定性种子重排，再逐件复验；最后一轮实际约 241 ms，仍未放入最后一件。可执行脚本：`node --import tsx src/scripts/reconstruct-pdf-eight-repair.ts`。
- 当时的局部建议是移动桥接块释放连续 3030 × 120 地板通道；该建议已被后续条件不可行证书替代，不再按 v2 继续搜索。不应把缺一件称作完整。

### 计时异常

`reconstruct-pdf-eight.ts` 某轮设置 55 s 外部监督，但 `supervision.json` 记录 **271193 ms 后 SIGKILL**，同时 worker 时间从约 1 s 跳至约 270 s。暂停、调度或其他原因未证实。因此不能声称这一轮满足绝对 55 s 墙钟限制；保留实际记录。后续局部 replay/repair 均保留各自监督结果。

## 第 9 柜：确定性全架 seed，102 / 122，独立校验有效

- 结果：`data/reconstruction/pdf-container-nine-seed/result.json`。这是新的几何研究 seed，**不替换原先 120 / 122 的更高装载件数 partial**；两者缺件结构不同。
- 81 条指定坐标全部由 `canPlaceAt` 接受，0 条拒绝；补排后 102 件均有效。三架全部在柜内，21 件 W02 超高框和 12 件 W02 扇均已放入，未更改其高度例外或空腔权限。
- 屋顶分配：4# 架上两列各 6 件 W04(2F) 平堆；16# 架上 6 件 W01 扇，载荷 600 kg；24# 架上 8 件 W03 与 10 件 W04(1F)，载荷 598.4 kg。第二列 W04 的悬出保持超过 80% 支撑；W03 堆从 x=2670 开始，避开相邻高架及上方 W04 的实体间隙。
- 当前缺件固定为 16 件 W08 框（源行 10）和 4 件 W06 扇（源行 20）。这清楚暴露了连续长通道不足，而非把三架移出柜来抬高装载件数。
- 下一步需同时预留两条 W08 平放 8 件堆：各 3180 × 220 × 2435 mm；以及 4 条 W06 侧放地板条：各 2654.5 × 110 × 1584.5 mm。现 seed 的 W02 竖框/竖扇通道已占用相应地板带，应重新安排这些带与屋顶分配；不能仅逐件追加，更不能根据同源单列 DP 宣称无解。
- 可复现：`node --import tsx src/scripts/reconstruct-pdf-nine-seed.ts`。整轮含验证约 0.7 s，单次补排约 254 ms；该脚本通过外部 30 s 子进程监督。

## 验证与追溯

每份 result 包含 config、sourceIds、校准/输入/审计哈希、相关 engine 文件 SHA256、种子及独立 validation；命令与源码固定了候选坐标。`reconstruction-decoder.test.ts` 新增了合法的多底件分载回归，避免再次以“单件 130 kg > 侧放顶部 120 kg”错误排除共享支撑；第八层因超出净高 4.5 mm 仍被拒绝。类型检查与定向测试通过。
