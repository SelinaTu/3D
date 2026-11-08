#!/usr/bin/env python3
#created 11/08/2026
"""Build attention-topic knowledge packs (JSON + MD encyclopedia). as_of 2026-10-31 Asia/Shanghai."""
from __future__ import annotations
import json
from pathlib import Path

AS_OF = "2026-10-31"
TZ = "Asia/Shanghai"
ROOT = Path(__file__).resolve().parents[1]  # globe/
DOCS = ROOT.parent / "docs" / "port-knowledge"
TOPICS_JSON = ROOT / "data" / "topics"
TOPICS_MD = DOCS / "topics"
TOPICS_JSON.mkdir(parents=True, exist_ok=True)
TOPICS_MD.mkdir(parents=True, exist_ok=True)

# Fresh X counts this run (get_posts_counts_recent, ~2026-10-24→10-31, -is:retweet)
X_COUNTS = {
    "dd_freetime_broad": 70,
    "vgm_solas": 2,
    "odol": 36,
    "blank_sailing": 24,
    "red_sea": 1200,
    "ispm15": 8,
    "customs_hold_dd": 6,
    "wdf_restow_accessorial": 3,
    "zh_detention": 5,
    "rolled_shutout": 19,
    "zh_shuai": 2,
    "misdeclaration": 1,
    "abandon": 56,  # note: may include noise; use cautiously
    "etle_odol": 0,
    "scfi_rates": 65,
    "free_time_strict": 53,
    "cre_rail": 2,
    "customs_storage": 10,
}

# Archive search_posts_all result_counts this run
X_ARCHIVE = {
    "demurrage_edu": 23,
    "odol": 20,
    "blank_sailing": 16,
    "vgm": 25,
    "rolled": 20,
    "ispm15": 18,
    "abandon_zh": 16,  # noisy / promo-heavy
    "wdf_accessorial": 19,  # mostly courier noise — honest note
}

DISCLAIMER = (
    "Not legal advice. Commercial fees ≠ administrative fines. "
    "Amounts require source URL + as_of. X evidence is heat/wording only."
)

def topic(**kwargs):
    kwargs.setdefault("as_of", AS_OF)
    kwargs.setdefault("timezone", TZ)
    kwargs.setdefault("layer", "attention")
    kwargs.setdefault("disclaimer", DISCLAIMER)
    return kwargs

TOPICS = []

# ---------- T01 ----------
TOPICS.append(topic(
    id="T01_demurrage_detention_storage_freetime",
    title_zh="滞期 / 滞箱 / 堆存 · Free time 三钟",
    title_en="Demurrage / Detention / Storage · Free time clocks",
    product_use="deep_field",
    confidence="high_definition_commercial_rates_variable",
    why_attention={
        "summary_zh": "从业科普最稳主题；近 7 天 EN demurrage|detention 语境约 70，free time 严格约 53；红海声量更大但不替代本条款字段。",
        "heat_7d": {"demurrage_detention_broad": X_COUNTS["dd_freetime_broad"], "free_time_strict": X_COUNTS["free_time_strict"], "zh_detention": X_COUNTS["zh_detention"]},
        "prior_report": "docs/port-knowledge/10_maritime_knowledge_pain_attention.md §A1-P1 / A2-E1",
        "note": "Amounts and free-day counts are carrier×terminal commercial — never invent a global number.",
    },
    definitions=[
        {"term": "Free time / Free days", "zh": "免费用箱/免堆期", "def": "Contracted period before demurrage, detention, or storage charges begin. Often different for import pickup vs empty return vs export gate-in."},
        {"term": "Last Free Day (LFD)", "zh": "最后免费日", "def": "Calendar day when free time ends; next day (or next tariff step) starts charging. Confirm timezone and whether LFD is inclusive."},
        {"term": "Demurrage", "zh": "滞期（码头内）", "def": "Charge while the loaded container remains inside the terminal/rail ramp past free time (before pickup). Industry convention: 'inside the fence'."},
        {"term": "Detention", "zh": "滞箱（码头外）", "def": "Charge while the carrier's container (and sometimes chassis) remains outside the terminal past free time after pickup, until empty return."},
        {"term": "Storage / Terminal storage", "zh": "堆存", "def": "Terminal/port authority charge for occupying yard space; may run in parallel with carrier demurrage depending on local tariff — verify per port."},
        {"term": "Combined D&D", "zh": "合并计费", "def": "Some carriers bill a single 'demurrage & detention' ladder; still track physical location of the box for dispute evidence."},
    ],
    who_pays={
        "typical": "Merchant (shipper/consignee/forwarder per contract/Incoterms) pays carrier D&D; terminal storage may be billed separately by terminal/NVOCC.",
        "note": "Who 'stops the clock' during customs exam or terminal inability is contractual/negotiated — FIATA argues free time should extend for periods merchant cannot act.",
    },
    who_responsible=[
        "Carrier publishes free time & tariff (commercial).",
        "Merchant monitors LFD, appointments, empty return.",
        "Terminal controls gate appointments / yard release — may affect ability to pick up.",
    ],
    common_pitfalls=[
        "Treating demurrage and detention as one fee and disputing the wrong party.",
        "Assuming '3–7 free days' is a law — it is not; it is tariff/contract.",
        "Clock continues during customs hold / failed trucker appointment unless tariff or negotiation says otherwise.",
        "Export demurrage while vessel delayed — FIATA argues carrier should own vessel delay; practice varies.",
        "Chassis per-diem layered on top of detention in some US trades.",
    ],
    official_sources=[
        {"url": "https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/", "org": "FIATA", "note": "2023-02 press: carriers should provide reasonable free time; points to Toolkit / Best Practice Guide"},
        {"url": "https://www.elea.ee/wp-content/uploads/2023/05/FIATA_Best-Practice-Guide-on-Demurrage-and-Detention_1810.pdf", "org": "FIATA (mirror PDF)", "note": "Best Practice Guide on Demurrage and Detention — definitions & negotiation recommendations"},
        {"url": "https://unctad.org/news/demurrage-and-detention-charges-container-shipping", "org": "UNCTAD", "note": "Summarizes FIATA WG recommendations (extend free time when terminal cannot release, etc.)"},
        {"url": "https://www.clecat.org/media/CLECAT%20Briefing%20&%20Industry%20Recommendations%20Paper%20on%20D&D%20Practices%20in%20Shipping_1.pdf", "org": "CLECAT", "note": "Industry briefing: demurrage inside / detention outside framing"},
        {"url": "https://www.maersk.com/logistics-explained/transportation-and-freight/2023/08/28/what-is-demurrage-detention-in-shipping-for-buyers", "org": "Maersk Logistics Explained", "note": "Carrier educational page (fetch occasionally 500 — URL retained as industry glossary)"},
    ],
    country_hooks=[
        {"iso2": "US", "note": "FMC has engaged on D&D reasonableness historically; still commercial — check carrier tariff + FMC complaint path"},
        {"iso2": "CN", "note": "Local terminal storage schedules vary by port; country pack has no unified free-time table"},
        {"iso2": "ID", "note": "Port gate ODOL enforcement can delay pickup → watch demurrage clock"},
        {"iso2": "NL", "note": "Rotterdam merchant haulage / detention free time often contested in industry papers"},
        {"iso2": "SG", "note": "Highly scheduled terminals — appointment failure still commercial risk"},
    ],
    port_hooks=[
        {"locode": "USLAX", "note": "USWC — chassis + demurrage narratives common"},
        {"locode": "USLGB", "note": "Same cluster as LAX"},
        {"locode": "USNYC", "note": "USEC — rail ramp LFD language common"},
        {"locode": "CNSHA", "note": "Export demurrage / yard congestion narratives"},
        {"locode": "SGSIN", "note": "Transshipment dwell + storage"},
        {"locode": "NLRTM", "note": "EU gateway — D&D education posts frequent"},
        {"locode": "IDTPP", "note": "Priok — ODOL gate × pickup delay"},
        {"locode": "IDSUB", "note": "Perak ODOL trial 2026 media"},
    ],
    faq=[
        {"q": "Demurrage 和 Detention 差在哪？", "a": "惯例：Demurrage = 重柜还在码头/堆场内超过 free time；Detention = 提柜后在码头外占有船司箱体超过 free time 未还空。有的船司合并账单，但争议证据仍应按位置分开。出处：FIATA/CLECAT/行业 glossary。"},
        {"q": "Free time 法定几天？", "a": "没有全球统一法定天数。由船司 tariff、合约或 NVOCC 条款约定。FIATA 主张应给合理免费用箱期，拥堵/码头无法放行时应等比延长——属谈判立场，非自动生效法条。"},
        {"q": "查验期间费用钟停不停？", "a": "多数情况下并不自动停钟；是否减免看船司/码头条款与协商。产品侧应标「待核实/合约」，禁止写死「查验免 demurrage」。"},
        {"q": "Storage 和 Demurrage 会不会重复收？", "a": "可能并行：码头收堆存、船司收 demurrage。逐港核对 tariff，勿假设互斥。"},
    ],
    x_evidence={
        "sample_size_this_run": {"counts_queries": 3, "archive_result_count": X_ARCHIVE["demurrage_edu"]},
        "samples": [
            {"url": "https://x.com/CandCWarehouse/status/2114532022844850568", "kind": "organic/edu", "note": "Inside vs outside clocks"},
            {"url": "https://x.com/RLGlobal/status/1701928927462076782", "kind": "organic/edu", "note": "Last Free Day dual meaning"},
            {"url": "https://x.com/LogTechEric/status/1568240243035308037", "kind": "organic", "note": "Practitioner: D vs D are different processes"},
            {"url": "https://x.com/niryatsetu1/status/2105581948458745922", "kind": "promo/edu", "note": "Inside=Demurrage Outside=Detention meme"},
        ],
        "honesty": "Many GMT+7 'receipts folklore' template posts — down-rank as promo/noise.",
    },
    gaps=[
        "No machine-readable free_time table per carrier×port in this pack",
        "Maersk glossary URL sometimes HTTP 500 from fetch env",
        "Terminal storage schedules not ingested",
    ],
))

# ---------- T02 ----------
TOPICS.append(topic(
    id="T02_vgm_solas",
    title_zh="VGM · SOLAS 验证总质量",
    title_en="VGM · SOLAS Verified Gross Mass",
    product_use="deep_field",
    confidence="high_statutory",
    why_attention={
        "summary_zh": "装船硬条件；近 7 天 X 精确热度仅约 2，但产品优先级不因此下降。CN/ID 国别包已有实施钩子。",
        "heat_7d": {"vgm_solas": X_COUNTS["vgm_solas"]},
        "prior_report": "10_* §A1-P2 / A2-E2 — 近周热度≠重要性",
    },
    definitions=[
        {"term": "VGM", "zh": "验证总质量", "def": "Verified gross mass of a packed container (cargo + packing + dunnage + tare). Required under SOLAS VI/2 as amended."},
        {"term": "Method 1", "zh": "方法一", "def": "Weigh the packed sealed container using calibrated equipment."},
        {"term": "Method 2", "zh": "方法二", "def": "Weigh all packages/items/securing material + add container tare using a method certified by the competent authority of the packing State."},
        {"term": "Shipper (SOLAS)", "zh": "托运人", "def": "Party named on BL/sea waybill (or who concluded the contract of carriage) — responsible for providing VGM (MSC.1/Circ.1475)."},
        {"term": "No VGM no load", "zh": "无 VGM 不得装船", "def": "Availability of VGM to master and terminal sufficiently in advance for stowage plan is a condition for loading (not an entitlement to load)."},
    ],
    who_pays={"typical": "Shipper obtains/pays for weighing; if terminal weighs on behalf of shipper, commercial parties apportion cost (Circ.1475 §13 contingencies)."},
    who_responsible=[
        "Shipper: obtain & document VGM, submit in time.",
        "Master & terminal: must have VGM before loading under SOLAS.",
        "National competent authority: Method 2 certification framework.",
    ],
    common_pitfalls=[
        "Confusing SI cargo weight with VGM — they can differ; large gaps trigger carrier WDF (commercial).",
        "Late VGM → rolled cargo / missed cutoff.",
        "Inventing national tolerances (e.g. folklore ±1000 kg) without statute URL.",
        "Assuming terminal reweigh always replaces shipper duty — contingencies are commercial.",
    ],
    official_sources=[
        {"url": "https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx", "org": "IMO", "note": "Official VGM page — SOLAS VI/2, Methods 1/2, shipper duty (fetched 2026-10-31)"},
        {"url": "https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/MSC.1%20Circ.1475.pdf", "org": "IMO", "note": "MSC.1/Circ.1475 Guidelines"},
        {"url": "https://www.gov.uk/government/publications/mgn-534-mf-guidance-on-the-implementation-of-the-solas-vi-regulation-2-amendment-requiring-the-verification-of-the-gross-mass-of-packed-containers", "org": "UK MCA", "note": "MGN 534 national implementation guidance"},
        {"url": "https://jdih.kemenhub.go.id/", "org": "Kemenhub JDIH", "note": "ID PM 25/2022 replaces PM 53/2018 — no VGM no load"},
        {"url": "https://xxgk.mot.gov.cn/2020/jigou/haishi/202006/t20200630_3319189.html", "org": "China MOT MSA", "note": "CN SOLAS VGM implementation narrative (country pack)"},
    ],
    country_hooks=[
        {"iso2": "CN", "field": "countries.CN.vgm", "note": "required_for_load; tolerance narrative ±5%/≤1t — verify current MSA text"},
        {"iso2": "ID", "field": "countries.ID.vgm", "note": "PM 25/2022; terminal reweigh ≥5% often refuse load (national dossier)"},
        {"iso2": "SG", "note": "Skeleton — SOLAS applies; local filing channels TBD"},
        {"iso2": "US", "note": "Skeleton — SOLAS applies via Coast Guard / industry practice"},
        {"iso2": "NL", "note": "Skeleton"},
        {"iso2": "DE", "note": "Skeleton"},
        {"iso2": "KR", "note": "Skeleton"},
        {"iso2": "MY", "note": "Skeleton"},
        {"iso2": "AE", "note": "Skeleton"},
    ],
    port_hooks=[{"locode": x, "note": "Deep pack inherits country VGM"} for x in
                ["CNSHA", "CNSZX", "CNNGB", "IDTPP", "IDSUB", "SGSIN", "NLRTM", "DEHAM", "USLAX", "USNYC"]],
    faq=[
        {"q": "谁必须交 VGM？", "a": "SOLAS 下责任在 shipper（提单/运输合同托运人）。货代可代办，但法律责任框架仍指向 shipper 定义（Circ.1475）。"},
        {"q": "没有 VGM 能装船吗？", "a": "原则上不能。指南允许船长与码头代表代为取得 VGM（如码头称重），费用分摊由商业约定——不是免费豁免。"},
        {"q": "Method 1 / 2 怎么选？", "a": "Method 1 整柜称重；Method 2 分项累加+皮重，且方法须经装箱完成国主管机关认可。选法看设施与国别规则。"},
        {"q": "近 7 天 X 几乎没人聊 VGM，还重要吗？", "a": "重要。热度低说明是「默会规则」而非热点八卦；装船阻断不依赖社媒刷屏。"},
    ],
    x_evidence={
        "sample_size_this_run": {"counts": X_COUNTS["vgm_solas"], "archive_result_count": X_ARCHIVE["vgm"]},
        "samples": [
            {"url": "https://x.com/cargolinked_com/status/2111381707144245751", "kind": "edu", "note": "No VGM → box rolls"},
            {"url": "https://x.com/FirstExplog/status/2106043136019431808", "kind": "promo/edu", "note": "No VGM. No loading."},
            {"url": "https://x.com/JohnSJamesCo/status/1720044368428450261", "kind": "media", "note": "Mis-declaration rampant narrative via Loadstar"},
            {"url": "https://x.com/BartGonnissen/status/1895056979250323950", "kind": "organic", "note": "Wrong VGM used in stow plan anecdote"},
        ],
    },
    gaps=["National Method-2 authority lists incomplete", "Dock reweigh priority rules per terminal thin"],
))

# ---------- T03 ----------
TOPICS.append(topic(
    id="T03_weight_limits_csc_road_odol",
    title_zh="限重三层 · CSC / 船司·VGM / 公路·ODOL",
    title_en="Three-layer weight limits · CSC / VGM-carrier / Road ODOL",
    product_use="deep_field",
    confidence="high_cn_id_skeleton_elsewhere",
    why_attention={
        "summary_zh": "规划引擎核心；印尼 ODOL 近 7 天约 36；「超重柜+罚款」严口径近周可为 0——执法在公路/卡口不在刷屏。",
        "heat_7d": {"odol": X_COUNTS["odol"], "etle_odol": X_COUNTS["etle_odol"]},
        "prior_report": "10_* §A1-P3; 02b_indonesia_national.md",
    },
    definitions=[
        {"term": "CSC max gross", "zh": "柜铭牌最大总重", "def": "Structural limit on CSC Safety Approval Plate — cargo+tare must not exceed."},
        {"term": "VGM / stowage limit", "zh": "船侧重量", "def": "SOLAS VGM + carrier/stack rules — can be stricter commercially than CSC."},
        {"term": "Road axle / GVW", "zh": "公路轴载/车货总重", "def": "National highway limits (e.g. CN MOT table; ID UU 22/2009 Kelas + MST; US Bridge Formula)."},
        {"term": "ODOL", "zh": "超限超载", "def": "Indonesia Over Dimension Over Loading — road enforcement at ports/tolls/industrial zones."},
        {"term": "JBI / JBKI", "zh": "允许总重/列车总重", "def": "Vehicle-specific permitted mass on KIR — NOT equal to ISO container payload."},
    ],
    who_pays={"typical": "Administrative fines hit vehicle operator/owner per national law; commercial refusal/WDF hit shipper; product must separate the two."},
    who_responsible=["Shipper/packer for mass distribution", "Haulier for road legality", "Terminal gate for local tonnage plaques (verify)", "Police/transport authority for ODOL/road"],
    common_pitfalls=[
        "Using ISO payload as road legal weight.",
        "Writing Rp 50 miliar ODOL fine into Pack — rumor_unverified vs UU caps.",
        "Ignoring Kelas road length/height (HC + chassis > 4.2 m).",
        "Mixing CN ¥30k road fine with carrier WDF USD.",
    ],
    official_sources=[
        {"url": "https://www.imo.org/en/about/conventions/pages/international-convention-for-safe-containers-%28csc%29.aspx", "org": "IMO CSC", "note": "Safe Containers Convention"},
        {"url": "https://www.gov.cn/zhengce/zhengceku/2021-08/26/content_5633469.htm", "org": "China gov.cn", "note": "MOT overlimit regulation — mass table + Art.43 fine formula"},
        {"url": "https://pelayanan.jakarta.go.id/download/regulasi/undang-undang-nomor-22-tahun-2009-tentang-lalu-lintas-dan-angkutan-jalan.pdf", "org": "UU 22/2009 mirror", "note": "ID road class + MST; Pasal 277/307 fine caps"},
        {"url": "https://peraturan.bpk.go.id/Download/311148/2021pmkemenhub018.pdf", "org": "Permenhub 18/2021", "note": "Freight loading supervision / JBI"},
        {"url": "https://ops.fhwa.dot.gov/freight/SW/faqs/qa.cfm", "org": "US FHWA", "note": "Federal weight FAQ — no national fine schedule"},
        {"url": "https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx", "org": "IMO CTU Code", "note": "Packing / load distribution practice (non-mandatory)"},
    ],
    country_hooks=[
        {"iso2": "CN", "field": "road_limits + fine_refs CN-OW-MASS", "note": "Thick — ¥500/t over 1t cap ¥30k"},
        {"iso2": "ID", "field": "road_limits MST + fine_refs Pasal 277/307", "note": "Thick — Rp 24jt / Rp 500rb statutory caps"},
        {"iso2": "US", "note": "Federal limits; state fines — skeleton"},
        {"iso2": "DE", "note": "BKatV % bands — see 05_fines"},
        {"iso2": "NL", "note": "ILT overbelading"},
        {"iso2": "KR", "note": "Road fines unverified gap"},
        {"iso2": "MY", "note": "Road fines unverified gap"},
        {"iso2": "AE", "note": "Road fines unverified gap"},
        {"iso2": "SG", "note": "Island road limits TBD skeleton"},
    ],
    port_hooks=[
        {"locode": "IDTPP", "note": "Priok toll access 45t media 2017 — current plaque unverified"},
        {"locode": "IDSUB", "note": "Perak ODOL trial 2026 (Kompas)"},
        {"locode": "IDBLW", "note": "Belawan ODOL gate narrative"},
        {"locode": "CNSHA", "note": "CN highway after gate"},
        {"locode": "USLAX", "note": "CA state/county schedules"},
    ],
    faq=[
        {"q": "柜能装的重量 = 能上路的重量吗？", "a": "不一定。CSC/ISO payload、VGM/船司、公路轴载/ODOL 是三层；任一超限都可能「装得上船、出不了门」。"},
        {"q": "印尼超载罚多少？", "a": "可引用 UU 22/2009：Pasal 307 上限约 Rp 500.000（装载/daya angkut）；Pasal 277 上限约 Rp 24.000.000（技术/改型语境）。网上「Rp 500 亿」类 → rumor_unverified，不进罚金字段。"},
        {"q": "中国治超封顶多少？", "a": "治超规章第 43 条叙述：未超 1000 kg 警告；其后每超 1000 kg ¥500，封顶 ¥30,000（以 gov.cn 现行文为准）。"},
        {"q": "Zero ODOL 2027 是新罚金表吗？", "a": "政策节奏是更严执行既有法，不是自动替换罚金表；港口是卡口之一。"},
    ],
    x_evidence={
        "sample_size_this_run": {"odol_7d": X_COUNTS["odol"], "archive": X_ARCHIVE["odol"]},
        "samples": [
            {"url": "https://x.com/kompascom/status/2109900925871820827", "kind": "media", "note": "Perak ODOL trial → Zero ODOL 2027"},
            {"url": "https://x.com/KompasOtomotif/status/2109127884266954994", "kind": "media", "note": "ODOL enforcement to ports"},
            {"url": "https://x.com/hubdat151/status/1624778488795496449", "kind": "gov", "note": "Ditjen Hubdat Zero ODOL messaging"},
            {"url": "https://x.com/soloposdotcom/status/1945742205592723690", "kind": "media", "note": "Policy discussion"},
        ],
        "rumor_unverified": ["Rp 50 miliar / Rp50 M ODOL headline amounts — not mapped to UU article in our verification"],
    },
    gaps=["Pelindo current gate tonnage plaques", "KR/MY/AE road fine tables", "Machine-readable stuffing bans none"],
))

# ---------- T04 ----------
TOPICS.append(topic(
    id="T04_rolled_blank_sailing",
    title_zh="甩柜 / Rolled · 空班 Blank sailing",
    title_en="Rolled cargo / shut-out · Blank sailing",
    product_use="faq_yellow",
    confidence="medium_definition_low_ticket_evidence",
    why_attention={
        "summary_zh": "定义教育稳定；严口径 rolled 近周冷，宽词易被体育污染。Blank sailing 近 7 天约 24，常绑运价。",
        "heat_7d": {"rolled_shutout": X_COUNTS["rolled_shutout"], "blank_sailing": X_COUNTS["blank_sailing"], "zh_shuai": X_COUNTS["zh_shuai"]},
    },
    definitions=[
        {"term": "Rolled cargo", "zh": "甩柜/甩货", "def": "Cargo booked but not loaded on the intended vessel (overbooking, docs, operational, weight, VGM late, etc.)."},
        {"term": "Shut-out", "zh": "关舱未上", "def": "Often used similarly to rolled when cargo misses cutoff / not accepted for that sailing."},
        {"term": "Blank sailing / void sailing", "zh": "空班/取消班期", "def": "Carrier cancels a scheduled sailing or omits ports — capacity management or disruption."},
        {"term": "Port omission", "zh": "跳港", "def": "Vessel skips a port in rotation — cargo may roll or transship."},
    ],
    who_pays={"typical": "Rebooking, storage, demurrage after roll often land on merchant depending on reason & contract; blank sailing is carrier schedule tool — liability case-by-case."},
    who_responsible=["Carrier space control", "Shipper docs/VGM/cutoff readiness", "Forwarder booking protection practices"],
    common_pitfalls=[
        "Assuming AIS 'vessel sailed' means YOUR container is aboard — verify container tracking.",
        "Wide Chinese '甩货' search polluted by sports metaphors — use strict queries.",
        "Ignoring demurrage clock after roll while box sits at origin terminal.",
    ],
    official_sources=[
        {"url": "https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx", "org": "IMO", "note": "Late/missing VGM is a common operational cause of not loading"},
        {"url": "https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/", "org": "FIATA", "note": "Export demurrage free time vs vessel delay — related negotiation theme"},
    ],
    country_hooks=[{"iso2": "CN", "note": "Export roll narratives at SHA/NGB peaks"}, {"iso2": "US", "note": "Import roll rare; blank sailing affects ETA"}, {"iso2": "ID", "note": "Feeder rolls to Priok common in industry talk — verify per booking"}],
    port_hooks=[{"locode": "CNSHA"}, {"locode": "CNNGB"}, {"locode": "CNSZX"}, {"locode": "SGSIN"}, {"locode": "NLRTM"}, {"locode": "USLAX"}],
    faq=[
        {"q": "船开了柜一定在船上吗？", "a": "不一定。Rolled cargo 就是订了舱但未装上原定船。应用箱号跟踪核验，不要只看船名 AIS。"},
        {"q": "Blank sailing 违法吗？", "a": "一般是船司运力管理/市场工具，不是「违法罚则」。影响是船期与舱位，可能连带费用钟。"},
        {"q": "被甩后会不会产生滞期？", "a": "柜若仍在起运港码头超过 free time，可能产生 export demurrage/堆存——取决于条款与责任归属。"},
    ],
    x_evidence={
        "sample_size_this_run": {"archive_rolled": X_ARCHIVE["rolled"], "archive_blank": X_ARCHIVE["blank_sailing"]},
        "samples": [
            {"url": "https://x.com/GuoDavid/status/2114916498036732410", "kind": "organic", "note": "Ship left ≠ container on it"},
            {"url": "https://x.com/integralcargo/status/1750134016835993995", "kind": "promo/edu", "note": "What is rolled cargo"},
            {"url": "https://x.com/djnel15/status/1486922491461345284", "kind": "organic", "note": "Overbook bump experience"},
            {"url": "https://x.com/tatin17/status/1966417125674725631", "kind": "organic", "note": "SCFI + blank sailings"},
            {"url": "https://x.com/flexport/status/1819053919277818119", "kind": "corp", "note": "Blank sailings with SCFI"},
        ],
    },
    gaps=["No predictive space model", "Carrier liability clauses not digitized"],
))

# ---------- T05 ----------
TOPICS.append(topic(
    id="T05_freight_rates_geopolitics",
    title_zh="运价与地缘（市场黄灯）",
    title_en="Freight rates & geopolitics (market yellow light)",
    product_use="market_yellow",
    confidence="high_attention_not_statutory",
    why_attention={
        "summary_zh": "近 7 天最大声量：红海/地缘×航运约 1200；SCFI/运价语境约 65。服务「关注层」叙事，不进罚则/Port Pack 法定字段。",
        "heat_7d": {"red_sea": X_COUNTS["red_sea"], "scfi_rates": X_COUNTS["scfi_rates"], "blank_sailing": X_COUNTS["blank_sailing"]},
    },
    definitions=[
        {"term": "SCFI", "zh": "上海出口集装箱运价指数", "def": "Shanghai Containerized Freight Index — spot market indicator, not a contract rate."},
        {"term": "WCI", "zh": "德路里世界集装箱指数", "def": "Drewry World Container Index — composite spot assessment."},
        {"term": "Spot vs contract", "zh": "即期 vs 合约", "def": "Spot fluctuates weekly; long-term contracts differ — neither is a 'fine'."},
        {"term": "Cape rerouting", "zh": "绕好望角", "def": "Avoiding Red Sea/Suez lengthens transit, absorbs capacity, supports rates narratives."},
    ],
    who_pays={"typical": "Shipper pays freight + bunker/accessorials per booking; geopolitics is market risk not a statutory fine."},
    who_responsible=["Carriers set blank sailings/rates", "BCOs/forwarders watch indices"],
    common_pitfalls=[
        "Putting SCFI numbers into fine_refs.",
        "Treating a tweeted index print as contractual quote.",
        "Ignoring that blank sailings are capacity tools tied to rate defense.",
    ],
    official_sources=[
        {"url": "https://unctad.org/topic/transport-and-trade-logistics", "org": "UNCTAD", "note": "Trade logistics / maritime transport research hub"},
        {"url": "https://www.imo.org/", "org": "IMO", "note": "Safety/security context — not a freight index publisher"},
    ],
    country_hooks=[{"iso2": "CN", "note": "SCFI origin"}, {"iso2": "US", "note": "Transpacific demand narratives"}, {"iso2": "NL", "note": "Asia-Europe gateway"}, {"iso2": "AE", "note": "Hub on diversion routes"}],
    port_hooks=[{"locode": "CNSHA"}, {"locode": "SGSIN"}, {"locode": "NLRTM"}, {"locode": "AEJEA"}, {"locode": "DEHAM"}],
    faq=[
        {"q": "为什么 Globe 要放运价层？", "a": "因为公众与货主近周真正刷屏的是地缘×运价；产品用「市场黄灯」分隔，避免与治超/VGM 法定层混淆。"},
        {"q": "能用 X 上的运价数字下单吗？", "a": "不能。以船司/货代正式报价与合约为准；指数仅供趋势。"},
    ],
    x_evidence={
        "sample_size_this_run": {"red_sea_7d": X_COUNTS["red_sea"], "rates_7d": X_COUNTS["scfi_rates"]},
        "samples": [
            {"url": "https://x.com/tatin17/status/1966417125674725631", "kind": "organic", "note": "SCFI weekly + blank sailings"},
            {"url": "https://x.com/EGoh3SAM/status/2086445062574231654", "kind": "organic", "note": "Drewry WCI outlook"},
            {"url": "https://x.com/Shipsnapxx/status/2082973470032634203", "kind": "media-ish", "note": "Blank sailings to defend rates"},
        ],
    },
    gaps=["No live index API in offline globe", "Geopolitical events change faster than packs"],
))

# ---------- T06 ----------
TOPICS.append(topic(
    id="T06_customs_hold_fee_clock",
    title_zh="海关查验 / Hold 与费用钟",
    title_en="Customs hold / exam vs fee clocks",
    product_use="faq_yellow",
    confidence="medium",
    why_attention={
        "summary_zh": "痛点高、结构化弱；近 7 天 customs×D&D 约 6，customs storage 约 10。官方无统一「谁停钟」。",
        "heat_7d": {"customs_hold_dd": X_COUNTS["customs_hold_dd"], "customs_storage": X_COUNTS["customs_storage"]},
    },
    definitions=[
        {"term": "Customs hold / exam", "zh": "海关查验/扣留", "def": "Cargo held for inspection, docs, or security — dwell increases."},
        {"term": "Exam fee", "zh": "查验相关费", "def": "May include terminal handling to exam site, gov fees, demurrage/storage while waiting — parties vary by country."},
        {"term": "Fee clock", "zh": "费用钟", "def": "Demurrage/detention/storage timers that may keep running during hold unless tariff/waiver says otherwise."},
    ],
    who_pays={"typical": "Often consignee/importer on destination exam; origin exam may hit shipper — Incoterms & local practice decide. Not a single global rule."},
    who_responsible=["Customs authority", "Broker/forwarder coordination", "Carrier/terminal billing desks"],
    common_pitfalls=[
        "Assuming hold auto-stops demurrage.",
        "Missing packing-list vs load-plan mismatch that triggers exam.",
        "No named contact path in Port Pack checklist.",
    ],
    official_sources=[
        {"url": "https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/", "org": "FIATA", "note": "Argues free time should reflect periods merchant cannot act (principle, not universal law)"},
        {"url": "https://www.elea.ee/wp-content/uploads/2023/05/FIATA_Best-Practice-Guide-on-Demurrage-and-Detention_1810.pdf", "org": "FIATA D&D guide", "note": "Negotiate extension when terminal cannot release"},
    ],
    country_hooks=[{"iso2": "US", "note": "CBP exam + demurrage disputes well-known"}, {"iso2": "CN", "note": "Customs exam + packing list align checklist"}, {"iso2": "ID", "note": "Quarantine/customs interfaces at Priok"}, {"iso2": "NL", "note": "EU customs at Rotterdam"}],
    port_hooks=[{"locode": "USLAX"}, {"locode": "USNYC"}, {"locode": "CNSHA"}, {"locode": "NLRTM"}, {"locode": "IDTPP"}],
    faq=[
        {"q": "查验时 demurrage 停不停？", "a": "多数不自动停。能否减免看船司/码头条款、当地惯例与协商。Globe 标「待核实/合约」。"},
        {"q": "产品能做什么？", "a": "Checklist：谁联系海关/船司/码头、证据留存、并行时钟提示——不是自动免单引擎。"},
    ],
    x_evidence={
        "sample_size_this_run": {"counts": X_COUNTS["customs_hold_dd"]},
        "samples": [
            {"url": "https://x.com/RecallAntonio/status/2021440019207213295", "kind": "promo-template", "note": "Mentions customs exam fees with D&D — down-rank template"},
        ],
        "honesty": "Sparse high-quality organic; prior 10_* used customs cluster more than this run's strict query.",
    },
    gaps=["Per-port 'clock stop' rules not sourced", "No structured exam fee tables"],
))

# ---------- T07 ----------
TOPICS.append(topic(
    id="T07_ispm15_wood_packing",
    title_zh="ISPM15 木质包装",
    title_en="ISPM 15 wood packaging",
    product_use="faq_yellow",
    confidence="high_definition_promo_heavy_on_x",
    why_attention={
        "summary_zh": "定义清晰；近 7 天约 8，归档页广告比例极高。裁判用 IPPC，不用熏蒸广告罚金话术。",
        "heat_7d": {"ispm15": X_COUNTS["ispm15"]},
    },
    definitions=[
        {"term": "ISPM 15", "zh": "国际植检措施标准第15号", "def": "IPPC standard for wood packaging material in international trade — debarked wood + approved treatment + mark."},
        {"term": "WPM", "zh": "木质包装材料", "def": "Pallets, crates, dunnage of raw wood; excludes processed wood like plywood (generally)."},
        {"term": "Mark", "zh": "IPPC 标识", "def": "Symbol + ISO country + producer code + treatment code (HT/DH/MB/SF); legible, durable, not hand-drawn."},
    ],
    who_pays={"typical": "Exporter/packer arranges treatment & marking; non-compliance risks refusal/treatment/destruction at import — costs on cargo interest per local NPPO rules."},
    who_responsible=["NPPO authorization of mark users", "Packer/shipper compliance", "Import NPPO inspection"],
    common_pitfalls=[
        "Hand-drawn or incomplete marks.",
        "Treating fumigation ads as statutory fine schedules.",
        "Forgetting dunnage inside containers.",
    ],
    official_sources=[
        {"url": "https://www.ippc.int/en/publications/640/", "org": "IPPC", "note": "ISPM 15 publication page (fetched 2026-10-31)"},
        {"url": "https://www.ippc.int/static/media/files/publication/en/2019/02/ISPM_15_2018_En_WoodPackaging_Post-CPM13_Rev_Annex1and2_Fixed_2019-02-01.pdf", "org": "IPPC PDF", "note": "ISPM 15 2018 EN with Annex 1–2"},
        {"url": "https://food.ec.europa.eu/plants/plant-health-and-biosecurity/trade-plants-plant-products-non-eu-countries/requirements-wood-packaging-dunnage_en", "org": "European Commission", "note": "EU import WPM based on ISPM 15"},
    ],
    country_hooks=[{"iso2": "CN", "note": "Checklist ispm15_if_wood in country pack"}, {"iso2": "US", "note": "APHIS enforces ISPM15"}, {"iso2": "NL", "note": "EU regime"}, {"iso2": "DE", "note": "EU regime"}, {"iso2": "ID", "note": "Quarantine interface"}],
    port_hooks=[{"locode": "USLAX"}, {"locode": "NLRTM"}, {"locode": "DEHAM"}, {"locode": "CNSHA"}],
    faq=[
        {"q": "哪些木头要 ISPM15？", "a": "国际贸易中的原木包装（含垫木）；经胶合热压等加工材（如胶合板）通常除外——以 ISPM15 正文为准。"},
        {"q": "没标记会怎样？", "a": "进口 NPPO 可能拒绝入境、退运、销毁或责令处理；具体措施国别不同。勿用广告里的「罚款 $X」当全球标准。"},
    ],
    x_evidence={
        "sample_size_this_run": {"archive": X_ARCHIVE["ispm15"]},
        "samples": [
            {"url": "https://x.com/shivshakti_ti/status/2061305633379676231", "kind": "promo", "note": "Myth vs fact ISPM15 — marketing"},
            {"url": "https://x.com/global_pallets/status/2103351465192640725", "kind": "promo", "note": "Compliance tip ad"},
        ],
        "honesty": "Archive almost all promo; use IPPC as referee.",
    },
    gaps=["Per-country NPPO refusal fee tables not collected"],
))

# ---------- T08 ----------
TOPICS.append(topic(
    id="T08_carrier_accessorials_wdf_restow",
    title_zh="承运人杂费 · WDF / Restow / Per diem",
    title_en="Carrier accessorials · WDF / Restow / Per diem",
    product_use="deep_field",
    confidence="medium_one_carrier_example",
    why_attention={
        "summary_zh": "L4 层核心；Maersk WDF 有公开 advisory。Restow 费率几乎挖不到。近 7 天宽查询约 3，且易被快递 weight discrepancy 污染。",
        "heat_7d": {"wdf_restow_accessorial": X_COUNTS["wdf_restow_accessorial"]},
    },
    definitions=[
        {"term": "Accessorial", "zh": "附加服务费", "def": "Carrier charges beyond ocean freight (THC, demurrage, WDF, restow, amendment, etc.)."},
        {"term": "WDF", "zh": "重量不符费", "def": "Weight Discrepancy Fee — commercial; e.g. Maersk when |SI weight − VGM| > threshold or VGM vs CSC/tare invalid."},
        {"term": "Restow", "zh": "倒柜/重积载", "def": "Moving containers on vessel/yard due to plan change — cost often commercial opaque."},
        {"term": "Per diem", "zh": "按日设备费", "def": "Often synonym/near to detention or chassis daily in US trades — check tariff wording."},
    ],
    who_pays={"typical": "Shipper/merchant per carrier invoice; NOT an administrative fine."},
    who_responsible=["Carrier tariff publication", "Shipper accurate SI/VGM"],
    common_pitfalls=[
        "Writing WDF into fine_refs as government penalty.",
        "Inventing restow USD amounts without tariff URL.",
        "Confusing courier 'weight discrepancy' tweets with ocean WDF.",
    ],
    official_sources=[
        {"url": "https://www.maersk.com/news/articles/2025/07/31/refresher-of-weight-discrepancy-fee-policy-indonesia", "org": "Maersk", "note": "ID refresher: WDF USD 300/container; >3000 kg SI vs VGM; VGM>max gross; VGM<tare (commercial)"},
        {"url": "https://www.maersk.com/news/articles/2024/09/12/update-wdf-weight-discrepancy-fee", "org": "Maersk", "note": "2024-10-15 effective update — USD 300 world origins stated"},
        {"url": "https://www.maersk.com/news/articles/2026/04/28/weight-discrepancy-fee-update-pre-notification", "org": "Maersk", "note": "2026-05-07 cutoff-date billing + pre-notification; tank threshold 5000 kg"},
        {"url": "https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx", "org": "IMO", "note": "VGM statutory backdrop for WDF commercial overlays"},
    ],
    country_hooks=[{"iso2": "ID", "field": "carrier_fees_examples Maersk WDF", "note": "Documented in countries.json"}, {"iso2": "SG", "note": "Maersk WDF PDF advisory also for SG local info"}, {"iso2": "CN", "note": "Other carriers' WDF TBD"}],
    port_hooks=[{"locode": "IDTPP"}, {"locode": "IDSUB"}, {"locode": "SGSIN"}, {"locode": "CNSHA"}],
    faq=[
        {"q": "Maersk WDF 多少钱？", "a": "公开 advisory 写 USD 300/柜（条件：SI 与 VGM 差 >3000 kg 等）。这是承运人费，不是行政罚。以船司当期通知为准（2026-05 起计费时点改到 cutoff）。"},
        {"q": "Restow 为什么不写金额？", "a": "可靠公开价目稀缺；禁止编造。有 dated tariff URL 再写入 L4。"},
    ],
    x_evidence={
        "sample_size_this_run": {"archive": X_ARCHIVE["wdf_accessorial"]},
        "samples": [],
        "honesty": "search for WDF|restow|accessorial returned mostly India courier Shiprocket disputes — not ocean. Prefer Maersk URLs over X.",
    },
    gaps=["Hapag/MSC/COSCO WDF tables", "Restow rate cards", "Chassis per-diem US schedules"],
))

# ---------- T09 ----------
TOPICS.append(topic(
    id="T09_misdeclaration_si_vgm",
    title_zh="错报 / SI≠VGM / 品名重量不一致",
    title_en="Misdeclaration · SI vs VGM · description mismatch",
    product_use="deep_field",
    confidence="medium",
    why_attention={
        "summary_zh": "安全+费用双风险；近 7 天严口径约 1。与 T02/T08 强相关。",
        "heat_7d": {"misdeclaration": X_COUNTS["misdeclaration"]},
    },
    definitions=[
        {"term": "Misdeclaration", "zh": "错报/瞒报", "def": "Wrong weight, commodity, hazard class, or quantity vs actual — safety & customs exposure."},
        {"term": "SI", "zh": "装船指示", "def": "Shipping Instruction — docs weight may differ from VGM; carriers may fee large gaps (WDF)."},
        {"term": "Packing list alignment", "zh": "箱单一致", "def": "Packing list ↔ load plan ↔ BL ↔ VGM consistency reduces exam/misdeclare risk."},
    ],
    who_pays={"typical": "Shipper faces carrier fees, possible authority penalties, cargo claims; amounts jurisdiction-specific — do not invent."},
    who_responsible=["Shipper declarations", "Forwarder QC", "Carrier acceptance checks"],
    common_pitfalls=["Updating VGM without SI", "Hazardous misclass", "Using estimated weights as VGM Method 2 without certified process"],
    official_sources=[
        {"url": "https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx", "org": "IMO", "note": "Misdeclared mass safety rationale"},
        {"url": "https://www.imo.org/en/ourwork/safety/pages/dangerousgoods.aspx", "org": "IMO IMDG", "note": "Dangerous goods declaration regime (high-level)"},
        {"url": "https://www.maersk.com/news/articles/2025/07/31/refresher-of-weight-discrepancy-fee-policy-indonesia", "org": "Maersk", "note": "Commercial consequence of SI/VGM gap"},
    ],
    country_hooks=[{"iso2": "CN", "note": "Customs packing list align checklist"}, {"iso2": "ID", "note": "VGM + WDF"}, {"iso2": "US", "note": "CBP + carrier"}, {"iso2": "NL", "note": "EU customs"}],
    port_hooks=[{"locode": "CNSHA"}, {"locode": "IDTPP"}, {"locode": "USLAX"}, {"locode": "NLRTM"}],
    faq=[
        {"q": "SI 和 VGM 必须完全一样吗？", "a": "应尽量一致。船司可对超过阈值的差异收 WDF（商业）；SOLAS 关心的是装船用的验证总质量真实性。"},
        {"q": "错报一定有固定罚金吗？", "a": "不一定。可能是船司费、海关处罚、民事索赔等不同机制——禁止用传闻金额填 Port Pack。"},
    ],
    x_evidence={
        "sample_size_this_run": {"counts": X_COUNTS["misdeclaration"]},
        "samples": [
            {"url": "https://x.com/JohnSJamesCo/status/1720044368428450261", "kind": "media", "note": "Weight mis-declaration industry article share"},
            {"url": "https://x.com/ONeillLogistics/status/1545408023010615297", "kind": "corp", "note": "Carriers crack down on wrong weights / late VGM"},
        ],
    },
    gaps=["National criminal/admin misdeclare schedules not compiled"],
))

# ---------- T10 ----------
TOPICS.append(topic(
    id="T10_abandon_cargo_destination_charges",
    title_zh="弃货 / 目的港费用回追",
    title_en="Abandoned cargo · destination charges chase-back",
    product_use="faq_yellow",
    confidence="medium_experience_not_statute",
    why_attention={
        "summary_zh": "出口商痛点；近 7 天 abandon 宽查询约 56（含噪声）。经验帖：目的港无人提→堆存/滞箱回追发货人。非法条价目。",
        "heat_7d": {"abandon": X_COUNTS["abandon"]},
    },
    definitions=[
        {"term": "Abandoned cargo", "zh": "弃货", "def": "Consignee fails to take delivery; cargo sits accruing storage/D&D; may be auctioned/destroyed under local rules."},
        {"term": "Destination charges", "zh": "目的港费用", "def": "THC, storage, demurrage, customs, disposal — who ultimately pays depends on contract & local recovery practice."},
        {"term": "Chase-back", "zh": "回追", "def": "Industry practice of billing origin shipper/forwarder when destination party disappears — contractual, not a universal statute."},
    ],
    who_pays={"typical": "Often shipper/forwarder at origin gets chased when consignee abandons — verify BL terms & local law; experience yellow light."},
    who_responsible=["Consignee for delivery", "Shipper credit control / release strategy", "Carrier recovery teams"],
    common_pitfalls=["Telex release without payment security", "Verbal '包过' promises", "Ignoring escalating storage while negotiating"],
    official_sources=[
        {"url": "https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/", "org": "FIATA", "note": "D&D context when cargo cannot move — still commercial"},
        {"url": "https://unctad.org/news/demurrage-and-detention-charges-container-shipping", "org": "UNCTAD", "note": "Industry D&D cost pressure context"},
    ],
    country_hooks=[{"iso2": "CN", "note": "ZH experience posts on chase-back"}, {"iso2": "US", "note": "Longstanding / auction regimes vary by terminal"}, {"iso2": "ID", "note": "Destination dwell + ODOL delays"}],
    port_hooks=[{"locode": "USLAX"}, {"locode": "USNYC"}, {"locode": "CNSHA"}, {"locode": "IDTPP"}],
    faq=[
        {"q": "买家不提货，费用谁扛？", "a": "实务上常回追发货人/订舱货代，但取决于运输合同、提单条款与当地处置规则。属经验黄灯，不是单一法典条文。"},
        {"q": "产品建议？", "a": "收款/放单节点、信用管控文案；监控目的港费用钟——不做罚单计算。"},
    ],
    x_evidence={
        "sample_size_this_run": {"counts": X_COUNTS["abandon"], "archive_zh": X_ARCHIVE["abandon_zh"]},
        "samples": [
            {"url": "https://x.com/APBLOODTYPE/status/2107425676563464254", "kind": "organic", "note": "Prior corpus: destination fee chase (v1.1)"},
            {"url": "https://x.com/Vita1945598/status/1847111378789957648", "kind": "edu", "note": "LCL destination charges education"},
        ],
        "honesty": "This-run ZH abandon query was noisy (promo/macro); keep prior organic URL.",
    },
    gaps=["Per-country abandonment statutory procedures not compiled"],
))

# ---------- T11 extra ODOL enforcement / ports ----------
TOPICS.append(topic(
    id="T11_indonesia_odol_port_enforcement",
    title_zh="印尼 Zero ODOL · 港口卡口执法",
    title_en="Indonesia Zero ODOL · port-gate enforcement",
    product_use="deep_field",
    confidence="high_policy_direction",
    why_attention={
        "summary_zh": "从 T03 拆出的关注簇：2026 媒体报道 Perak 等港口试执法；目标年多报 2027。ETLE+ODOL 近 7 天精确计数 0。",
        "heat_7d": {"odol": X_COUNTS["odol"], "etle_odol": X_COUNTS["etle_odol"]},
        "prior_report": "02b_indonesia_national.md §2.5–2.6",
    },
    definitions=[
        {"term": "Zero ODOL", "zh": "零超限超载目标", "def": "Policy push to eliminate ODOL practice; 2025 messaging emphasized enforcing existing UU rather than new fine statute; target year often reported 2027."},
        {"term": "Port as checkpoint", "zh": "港口卡口", "def": "Enforcement narrative includes pelabuhan, toll, industrial zones — containers leaving gate enter road regime."},
        {"term": "WIM", "zh": "动态称重", "def": "Weigh-in-motion systems mentioned in enforcement modernization — verify deployment status per corridor."},
    ],
    who_pays={"typical": "Vehicle operator under UU 22/2009; cargo interest may face delay/refusal commercially."},
    who_responsible=["Kemenhub / Hubdat", "Korlantas", "Pelindo/terminal gate processes", "Hauliers"],
    common_pitfalls=["Treating 2027 as a new Rp fine table", "Ignoring JBI on KIR", "Using 2017 Priok 45t article as current without re-verify"],
    official_sources=[
        {"url": "https://kemenhub.go.id/post/read/menhub-dudy-tegaskan-penanganan-angkutan-odol-harus-segera-dilaksanakan", "org": "Kemenhub", "note": "Minister statement on ODOL handling"},
        {"url": "https://korlantas.polri.go.id/pemerintah-komitmen-sosialisasikan-strategi-penegakan-hukum-terhadap-kendaraan-truk-over-dimension-dan-overload/", "org": "Korlantas", "note": "Enforcement socialization"},
        {"url": "https://hubdat.dephub.go.id/id/bptd/sulteng/publikasi/stop-odol/", "org": "Hubdat Stop ODOL", "note": "Campaign page (availability intermittent)"},
        {"url": "https://pelayanan.jakarta.go.id/download/regulasi/undang-undang-nomor-22-tahun-2009-tentang-lalu-lintas-dan-angkutan-jalan.pdf", "org": "UU 22/2009", "note": "Statutory fine caps Pasal 277/307"},
    ],
    country_hooks=[{"iso2": "ID", "field": "countries.ID", "note": "Thick country pack"}],
    port_hooks=[
        {"locode": "IDSUB", "note": "2026 Kompas: Perak trial site"},
        {"locode": "IDTPP", "note": "National hub — gate ODOL pressure"},
        {"locode": "IDBLW", "note": "Belawan"},
        {"locode": "IDSRG", "note": "Emas"},
        {"locode": "IDMAK", "note": "Makassar"},
    ],
    faq=[
        {"q": "港口治超和公路治超一样吗？", "a": "港口是卡口叙事的一部分：出门即进入公路/ODOL 体制。具体吨位牌以码头现行公告为准（Priok 45t 为历史报道，待核实）。"},
        {"q": "ETLE 自动罚 ODOL？", "a": "本轮近 7 天 ETLE+ODOL 精确计数为 0；不要把电子警察传说写成现行自动罚则。"},
    ],
    x_evidence={
        "sample_size_this_run": {"odol_archive": X_ARCHIVE["odol"]},
        "samples": [
            {"url": "https://x.com/kompascom/status/2109900925871820827", "kind": "media", "note": "Perak ODOL trial"},
            {"url": "https://x.com/jasacustoms/status/2105223867862040585", "kind": "organic", "note": "Zero ODOL 2027 landside pressure"},
            {"url": "https://x.com/hubdat151/status/1624778488795496449", "kind": "gov", "note": "Hubdat campaign"},
        ],
        "rumor_unverified": ["Rp50 miliar headlines"],
    },
    gaps=["Pelindo plaque photos/as_of", "WIM corridor list"],
))

# ---------- T12 CRE weak ----------
TOPICS.append(topic(
    id="T12_china_railway_express_load_bias",
    title_zh="中欧班列偏载（薄）",
    title_en="China Railway Express load bias (thin)",
    product_use="faq_yellow",
    confidence="low_thin",
    why_attention={
        "summary_zh": "05_fines 已声明统一行政罚金稀缺；近 7 天 CRE×偏载约 2。收录为诚实薄包，防伪密度。",
        "heat_7d": {"cre_rail": X_COUNTS["cre_rail"]},
    },
    definitions=[
        {"term": "CRE / 中欧班列", "zh": "中欧班列", "def": "China-Europe block trains — rail CTU load distribution rules differ from ocean but share overweight/bias concerns."},
        {"term": "偏载偏重", "zh": "偏载偏重", "def": "Uneven or concentrated load — may force restow/delay; published public fine schedules scarce."},
    ],
    who_pays={"typical": "Shipper/operator for restow/delay — verify operator notices; no unified fine table in our sources."},
    who_responsible=["Shipper packing", "CRE operator acceptance"],
    common_pitfalls=["Inventing CRE administrative fine RMB amounts", "Assuming ocean Port Pack rules apply unchanged to rail"],
    official_sources=[
        {"url": "https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx", "org": "IMO/ILO/UNECE CTU", "note": "Load distribution practice applicable to CTUs generally"},
        {"url": "https://unece.org/transport/documents/standards/ctu-code", "org": "UNECE", "note": "CTU Code downloads"},
    ],
    country_hooks=[{"iso2": "CN", "note": "Origin CRE; see 05_fines CRE-BIAS stub"}, {"iso2": "DE", "note": "EU rail destination practices vary"}, {"iso2": "NL", "note": "Same"}],
    port_hooks=[],
    faq=[
        {"q": "为什么几乎没内容？", "a": "因为公开、可核、机器可读的班列偏载罚金表稀缺。诚实标薄优于编造。"},
    ],
    x_evidence={
        "sample_size_this_run": {"counts": X_COUNTS["cre_rail"]},
        "samples": [],
        "honesty": "Insufficient organic evidence this run.",
    },
    gaps=["Operator-specific loading notices", "Unified admin fine schedule"],
))


def to_md(t: dict) -> str:
    lines = [
        f"# {t['id']} · {t['title_zh']}",
        "",
        f"> **Attention layer** · as_of **{t['as_of']}** ({t['timezone']}) · product_use `{t['product_use']}` · confidence `{t['confidence']}`",
        f"> {t.get('disclaimer','')}",
        "",
        f"**EN:** {t['title_en']}",
        "",
        "## Why attention",
        "",
        t["why_attention"].get("summary_zh", ""),
        "",
        "```json",
        json.dumps({k: v for k, v in t["why_attention"].items() if k != "summary_zh"}, ensure_ascii=False, indent=2),
        "```",
        "",
        "## Definitions",
        "",
    ]
    for d in t["definitions"]:
        lines.append(f"- **{d['term']}**（{d.get('zh','')}）: {d['def']}")
    lines += ["", "## Who pays / responsible", "", f"- Pays: {t['who_pays'].get('typical','')}", f"- Note: {t['who_pays'].get('note','')}"]
    for r in t.get("who_responsible", []):
        lines.append(f"- Responsible: {r}")
    lines += ["", "## Common pitfalls", ""]
    for p in t["common_pitfalls"]:
        lines.append(f"- {p}")
    lines += ["", "## Official sources", ""]
    for s in t["official_sources"]:
        lines.append(f"- [{s['org']}]({s['url']}) — {s['note']}")
    lines += ["", "## Country hooks", ""]
    for c in t.get("country_hooks", []):
        lines.append(f"- **{c['iso2']}**: {c.get('note','')} {('· `'+c['field']+'`') if c.get('field') else ''}")
    lines += ["", "## Port hooks", ""]
    ph = t.get("port_hooks") or []
    if not ph:
        lines.append("- _(none / thin)_")
    for p in ph:
        lines.append(f"- `{p['locode']}` {p.get('note','')}")
    lines += ["", "## FAQ", ""]
    for f in t["faq"]:
        lines.append(f"### Q: {f['q']}")
        lines.append("")
        lines.append(f"{f['a']}")
        lines.append("")
    lines += ["", "## X evidence (heat only)", ""]
    lines.append("```json")
    lines.append(json.dumps(t["x_evidence"], ensure_ascii=False, indent=2))
    lines.append("```")
    lines += ["", "## Gaps", ""]
    for g in t["gaps"]:
        lines.append(f"- {g}")
    lines += ["", "---", "", "*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*", ""]
    return "\n".join(lines)


def main():
    index = {
        "as_of": AS_OF,
        "timezone": TZ,
        "layer": "attention",
        "knowledge_version": "1.2.0",
        "topic_count": len(TOPICS),
        "disclaimer": DISCLAIMER,
        "x_research_this_run": {
            "count_queries": 18,
            "archive_queries": 8,
            "counts": X_COUNTS,
            "archive_result_counts": X_ARCHIVE,
            "note": "Complementary ZH+EN+ID queries; abandon/WDF archives noisy; Red Sea is market attention not statute.",
        },
        "topics": [],
    }
    for t in TOPICS:
        tid = t["id"]
        # short id file name
        fname = tid + ".json"
        (TOPICS_JSON / fname).write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        mdname = tid + ".md"
        (TOPICS_MD / mdname).write_text(to_md(t), encoding="utf-8")
        index["topics"].append({
            "id": tid,
            "file": fname,
            "title_zh": t["title_zh"],
            "title_en": t["title_en"],
            "product_use": t["product_use"],
            "confidence": t["confidence"],
            "port_hooks": [p["locode"] for p in (t.get("port_hooks") or [])],
            "country_hooks": [c["iso2"] for c in (t.get("country_hooks") or [])],
            "heat_rank_hint": t["why_attention"].get("heat_7d"),
        })
    (TOPICS_JSON / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    readme = f"""# Attention topics · 关注层百科

as_of **{AS_OF}** Asia/Shanghai · mirrors `globe/data/topics/`

同一颗 Knowledge Globe 的**第二层**：按「大家在盯 / 科普在讲」的主题包提供详尽基础知识（定义、责任、坑、官方出处、FAQ），热度只排序，裁判仍是官方/船司。

| ID | 中文 | product_use |
| --- | --- | --- |
""" + "\n".join(f"| `{t['id']}` | {t['title_zh']} | `{t['product_use']}` |" for t in TOPICS) + f"""

打开地球仪 → 顶栏切换 **关注** → 点主题；或点港口后看 Related topics chips。

X 本轮：约 **18** counts + **8** archive 查询；详见 `index.json` → `x_research_this_run` 与 `10_maritime_knowledge_pain_attention.md`。
"""
    (TOPICS_MD / "README.md").write_text(readme, encoding="utf-8")
    print(f"Wrote {len(TOPICS)} topics → {TOPICS_JSON} and {TOPICS_MD}")


if __name__ == "__main__":
    main()
