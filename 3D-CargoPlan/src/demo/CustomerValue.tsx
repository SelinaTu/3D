// #created 11/08/2026
import { useState } from 'react'
import { annualSeatUsd, buyers, competitorSeat, demoLoad, seatPoolUsd } from './customer-value'
import { SeaLandDemo } from './SeaLandDemo'
import './customer-value.css'

const easyCargoYear = competitorSeat.easyCargoAnnualUsd
const cubeMasterYear = annualSeatUsd(competitorSeat.cubeMasterStandardMonthlyUsd)
const guangzhouEasy = seatPoolUsd(buyers.guangzhouLegalPersons, easyCargoYear)
const guangzhouCube = seatPoolUsd(buyers.guangzhouLegalPersons, cubeMasterYear)
const nationalEasy = seatPoolUsd(buyers.nationalLegalPersonsEnd2022, easyCargoYear)
const usd = (n: number) => n.toLocaleString('en-US')

export function CustomerValue() {
  const [showLoad, setShowLoad] = useState(false)
  return <main className="value-page">
    <p className="value-kicker">DEMO · ONE SHIPMENT · ONE SEAT</p>
    <h1>3D装箱如何减少卸货阻挡，以及这张座位费覆盖多大的市场</h1>
    <p className="value-lead">下面每个数字要么来自本仓库对同一批 29 件货的两次装箱，要么来自竞品公开标价乘以一份点过名的企业备案数。没有把物流总费用、数字货代流水或研报里的几十亿美元算进这张账单。</p>

    <section className="value-nums" aria-label="这一票的实测结果">
      <div><b>{demoLoad.pieces}</b><span>件货，{demoLoad.weightKg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg，{demoLoad.stops} 个卸货站</span></div>
      <div><b>{demoLoad.blocksWhenUnloadOrderKept}</b><span>按先卸后装：陆运和海运的跨站阻挡</span></div>
      <div><b>{demoLoad.landBlocksWhenOrderIgnored}</b><span>同一批货忽略卸货顺序后，陆运跨站阻挡</span></div>
      <div><b>{demoLoad.seaBlocksWhenOrderIgnored}</b><span>同一批货忽略卸货顺序后，海运跨站阻挡</span></div>
    </section>

    <div className="value-row">
      <article className="value-card dark">
        <h2>客户拿到的结果</h2>
        <p>按卸货顺序装，先卸的货在更靠门的一侧，陆运和海运的跨站阻挡都是 {demoLoad.blocksWhenUnloadOrderKept}。同一批货只按尺寸往里塞时，陆运有 {demoLoad.landBlocksWhenOrderIgnored} 件被更晚卸的货挡住，海运有 {demoLoad.seaBlocksWhenOrderIgnored} 件。客户在发车前看到的是这张清单：哪一件被后站货物挡住。</p>
        <p>阻挡数是门这一侧的几何挡住，用来决定这件货能不能先卸。页面没有把挡住折成工时或人民币。</p>
        <div className="value-actions"><button type="button" onClick={() => setShowLoad((open) => !open)}>{showLoad ? '收起这 29 件的摆放' : '展开这 29 件的陆运和海运摆放'}</button></div>
      </article>
      <article className="value-card">
        <h2>竞品座位已经在卖的部分</h2>
        <p>EasyCargo 公开年费 {usd(easyCargoYear)} 美元/用户。CubeMaster Online 标准版 {competitorSeat.cubeMasterStandardMonthlyUsd} 美元/账户/月，按 12 个月计为 {usd(cubeMasterYear)} 美元。定价页没有给出与月费等额的年付牌价，所以年席用月费乘 12。</p>
        <p>这份费用买到 Excel 导入、三维摆放、优先组和重量检查。EasyCargo 的公开说明还写明：按长方体计算，人工改放不会执行全部约束，公开 API 不能直接触发计算。</p>
      </article>
    </div>

    <h3>证据链</h3>
    <table>
      <thead><tr><th>客户的问题</th><th>本仓库测到的结果</th><th>客户因此可以做的决定</th></tr></thead>
      <tbody>
        <tr><td>三站的货塞进一辆尾门车，第一站卸得出来吗</td><td>29 件全部放下。按卸货顺序，跨站阻挡 {demoLoad.blocksWhenUnloadOrderKept}。只按尺寸往里塞，跨站阻挡 {demoLoad.landBlocksWhenOrderIgnored}。</td><td>发车前指出哪几件被后站货物挡住，决定第一站能不能直接卸。</td></tr>
        <tr><td>同一批货进一只高柜，靠门的是不是先卸的辅材</td><td>按组摆放时跨站阻挡 {demoLoad.blocksWhenUnloadOrderKept}。忽略分组时跨站阻挡 {demoLoad.seaBlocksWhenOrderIgnored}。</td><td>装箱图可以交给目的港的卸货班。先卸的一组在门这一侧。</td></tr>
        <tr><td>进某个港之前，免费期和危货类别能不能直接套别的港</td><td>助手只在问题点了港口时使用该港卡片。德班硝酸铵不按普通 5.1 办理。蒙德拉进口重箱的免费天数按该码头费册，金额不写进答复。</td><td>操作员看到的是一条港口规则和出处，不是一条可以拿去报价的单价。</td></tr>
      </tbody>
    </table>
    <p className="value-note">这 29 件是演示子集，重量 {demoLoad.weightKg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg。完整 Excel 有 1,371 件，那是另一条导入路径，不能把 1,371 件的重量说成这一票已经全部装进上面的车或柜。也没有在 EasyCargo 账号里重跑这 29 件，所以不说对方软件会得到 {demoLoad.landBlocksWhenOrderIgnored} 或 {demoLoad.seaBlocksWhenOrderIgnored}。</p>

    <h3>市场：竞品年费 × 已点名的货代法人数</h3>
    <table>
      <thead><tr><th>买家池</th><th>计算</th><th>一年的座位费</th></tr></thead>
      <tbody>
        <tr><td>广州备案法人货代 {buyers.guangzhouLegalPersons.toLocaleString('en-US')} 家，每家 1 个 EasyCargo 年席</td><td>{buyers.guangzhouLegalPersons.toLocaleString('en-US')} × {easyCargoYear}</td><td>{usd(guangzhouEasy)} 美元</td></tr>
        <tr><td>同一广州池，每家 1 个 CubeMaster 标准年席</td><td>{buyers.guangzhouLegalPersons.toLocaleString('en-US')} × {competitorSeat.cubeMasterStandardMonthlyUsd} × 12</td><td>{usd(guangzhouCube)} 美元</td></tr>
        <tr><td>2022 年底全国备案法人 {buyers.nationalLegalPersonsEnd2022.toLocaleString('en-US')} 家，每家 1 个 EasyCargo 年席</td><td>{buyers.nationalLegalPersonsEnd2022.toLocaleString('en-US')} × {easyCargoYear}</td><td>{usd(nationalEasy)} 美元</td></tr>
      </tbody>
    </table>
    <p className="value-note">这是「每一家法人货代都买一个装箱座位」的上限。备案名单里有只做订舱、不做装箱的公司，官方没有公布装箱岗占比，所以这里不乘 10% 或任何其他比例。3D舱策没有付费座位，不从这三行里分走一个份额。第一批能对上这张账单的客户，是已经在付 {usd(cubeMasterYear)}–{usd(easyCargoYear)} 美元/人/年、而且货物要分站卸的货代和专线。</p>

    {showLoad && <SeaLandDemo />}
    <footer>
      29 件、2,738.09 kg、阻挡数：<code>src/demo/scenarios.ts</code> 与 <code>packPlan</code> 在优先级模式和忽略分组模式下的复算，测试见 <code>src/demo/customer-value.test.ts</code>。EasyCargo 799 美元/用户/年见其官网，项目核对日 2026-10-30，并见 <code>docs/EASYCARGO_BENCHMARK_AND_PRODUCT_PLAN.md</code>。CubeMaster Online 标准版 49 美元/账户/月见定价页，检索日 2026-10-31。广州 4,516 家法人：广州市商务局 2025-01-26《2024年第四季度广州市办理国际货运代理企业备案情况》，截至 2024-12-31 累计备案 5,055 家，其中法人 4,516 家。全国 77,367 家法人：中国货代协会《中国国际货代物流行业发展蓝皮书（2022）》，新华网 2023-11-18 报道，截至 2022 年底。
    </footer>
  </main>
}
