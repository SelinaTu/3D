<!-- #created 11/08/2026 -->
# 用户8柜附件审核证据

审核结论与具体反例见 [docs/EIGHT_CONTAINER_REVIEW.md](../../../docs/EIGHT_CONTAINER_REVIEW.md)。没有覆盖当前11柜结果，也没有执行附件HTML或JavaScript。

- `source.zip`：用户提供的原ZIP逐字节副本，SHA256 `34035df109dc9420d23756848eaab12f937a471d4f64556b98b5122280f2c093`。
- `input-provenance.json`：原路径及解压后每文件字节SHA。
- `audit-evidence.tar.gz`：全部解压输入、三个独立审计脚本和明细、1371件映射、当前校验器复核输出；SHA256 `fbcbdaedcc5586eb8b923cc488a8e687565c05f4e789c4c14fd133cbb084a431`。
- `summary.json`：关键数量和归档指纹。

在项目根目录恢复证据和复算（只读取静态数据，不打开附件HTML）：

```sh
tar -xzf data/reviews/eight-container/audit-evidence.tar.gz
python3 output/audit-eight/geometry-audit.py
python3 output/audit-eight/assumption-audit.py
node --import tsx output/audit-eight/recheck.ts
```

库存审计逐件按源表、源行和展开单位序号核对原数据，采用CSV旋转矩阵反算原轴尺寸；完整结果为`output/audit-eight/inventory-audit.json`。物理库存1371件全部一致。289件原净空越界、5339对留缝不足、391件孔内方向/类别不符；顶部单件及平放件数反例另列于规则审核。当前校验器为货物原模型复核，不把新增未验证木架当作已获工程认可的承托。
