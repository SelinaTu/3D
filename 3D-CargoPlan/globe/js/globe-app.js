// #created 11/08/2026
/* CargoPlan Knowledge Globe — foundation + attention topics */
(function () {
  "use strict";

  const DATA = {
    ports: [],
    countries: {},
    conventions: { items: [] },
    meta: {},
    packs: {},
    topicsIndex: { topics: [] },
    topics: {},
  };

  const el = {
    globe: document.getElementById("globeViz"),
    stats: document.getElementById("statsBox"),
    search: document.getElementById("searchInput"),
    hits: document.getElementById("searchHits"),
    panel: document.getElementById("sidePanel"),
    panelTitle: document.getElementById("panelTitle"),
    panelMeta: document.getElementById("panelMeta"),
    panelBody: document.getElementById("panelBody"),
    close: document.getElementById("closePanel"),
    footerDisc: document.getElementById("footerDisc"),
    footerMeta: document.getElementById("footerMeta"),
    btnFoundation: document.getElementById("btnFoundation"),
    btnAttention: document.getElementById("btnAttention"),
  };

  let globe = null;
  let selected = null;
  let activeLayer = "foundation";
  let lastPort = null;

  async function loadJSON(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  }

  async function boot() {
    const [ports, countries, conventions, meta, topicsIndex] = await Promise.all([
      loadJSON("data/ports.json"),
      loadJSON("data/countries.json"),
      loadJSON("data/conventions.json"),
      loadJSON("data/meta.json"),
      loadJSON("data/topics/index.json"),
    ]);
    DATA.ports = ports;
    DATA.countries = countries;
    DATA.conventions = conventions;
    DATA.meta = meta;
    DATA.topicsIndex = topicsIndex;

    const packIds = meta.port_packs || [];
    await Promise.all(
      packIds.map(async (id) => {
        try {
          DATA.packs[id] = await loadJSON("data/port_packs/" + id + ".json");
        } catch (e) {
          console.warn("pack miss", id, e);
        }
      })
    );

    const topicIds = (topicsIndex.topics || []).map((t) => t.id);
    await Promise.all(
      topicIds.map(async (id) => {
        try {
          DATA.topics[id] = await loadJSON("data/topics/" + id + ".json");
        } catch (e) {
          console.warn("topic miss", id, e);
        }
      })
    );

    el.stats.innerHTML =
      "<strong>" +
      (meta.port_count || ports.length).toLocaleString() +
      "</strong> seaports · <strong>" +
      (meta.deep_port_count || 0) +
      "</strong> deep · <strong>" +
      (meta.topic_count || topicIds.length) +
      "</strong> topics";
    el.footerDisc.textContent =
      (meta.disclaimer_zh || "") + " · " + (meta.disclaimer || "");
    el.footerMeta.textContent =
      "as_of " +
      (meta.as_of || "—") +
      " (" +
      (meta.timezone || "Asia/Shanghai") +
      ") · knowledge v" +
      (meta.knowledge_version || "?") +
      " · globe v" +
      (meta.globe_version || "0.1");

    initGlobe();
    wireSearch();
    wireLayers();
    el.close.addEventListener("click", () => {
      el.panel.classList.add("hidden");
      selected = null;
    });
  }

  function wireLayers() {
    function setLayer(layer) {
      activeLayer = layer;
      el.btnFoundation.classList.toggle("active", layer === "foundation");
      el.btnAttention.classList.toggle("active", layer === "attention");
      el.btnFoundation.setAttribute("aria-selected", layer === "foundation" ? "true" : "false");
      el.btnAttention.setAttribute("aria-selected", layer === "attention" ? "true" : "false");
      if (layer === "attention") {
        openTopicBrowser();
      } else if (lastPort) {
        openPort(lastPort);
      } else {
        el.panel.classList.add("hidden");
      }
    }
    el.btnFoundation.addEventListener("click", () => setLayer("foundation"));
    el.btnAttention.addEventListener("click", () => setLayer("attention"));
  }

  function pointColor(p) {
    return p.depth === "deep" ? "#B8FF00" : "rgba(90, 110, 140, 0.55)";
  }
  function pointAlt(p) {
    return p.depth === "deep" ? 0.018 : 0.004;
  }
  function pointRadius(p) {
    return p.depth === "deep" ? 0.45 : 0.12;
  }

  function initGlobe() {
    const deep = DATA.ports.filter((p) => p.depth === "deep");
    const thin = DATA.ports.filter((p) => p.depth !== "deep");
    const points = thin.concat(deep);

    globe = Globe()(el.globe)
      .globeImageUrl("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg")
      .bumpImageUrl("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png")
      .backgroundImageUrl("https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png")
      .showAtmosphere(true)
      .atmosphereColor("#B8FF00")
      .atmosphereAltitude(0.12)
      .pointsData(points)
      .pointLat("lat")
      .pointLng("lon")
      .pointColor(pointColor)
      .pointAltitude(pointAlt)
      .pointRadius(pointRadius)
      .pointLabel((p) =>
        `<div style="font:12px/1.3 IBM Plex Sans,sans-serif;padding:4px 6px">
          <b style="color:#B8FF00">${esc(p.locode)}</b> ${esc(p.name)}${p.name_zh ? " · " + esc(p.name_zh) : ""}
          <div style="opacity:.7;font-size:11px">${p.depth === "deep" ? "DEEP Port Pack" : "thin · UN/LOCODE"}</div>
        </div>`
      )
      .onPointClick((p) => {
        activeLayer = "foundation";
        el.btnFoundation.classList.add("active");
        el.btnAttention.classList.remove("active");
        openPort(p);
      })
      .enablePointerInteraction(true);

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.35;
    globe.controls().enableDamping = true;

    window.addEventListener("resize", () => {
      globe.width(window.innerWidth);
      globe.height(window.innerHeight);
    });
    globe.width(window.innerWidth);
    globe.height(window.innerHeight);
    globe.pointOfView({ lat: 20, lng: 110, altitude: 2.1 }, 0);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wireSearch() {
    let t = null;
    el.search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => renderHits(el.search.value.trim()), 120);
    });
    el.search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        el.hits.style.display = "none";
        el.search.blur();
      }
    });
    document.addEventListener("click", (e) => {
      if (!el.hits.contains(e.target) && e.target !== el.search) {
        el.hits.style.display = "none";
      }
    });
  }

  function renderHits(q) {
    if (!q || q.length < 1) {
      el.hits.style.display = "none";
      el.hits.innerHTML = "";
      return;
    }
    const qq = q.toUpperCase();
    const qLower = q.toLowerCase();
    const scored = [];
    for (const p of DATA.ports) {
      let score = 0;
      if (p.locode === qq) score = 100;
      else if (p.locode.startsWith(qq)) score = 80;
      else if (p.locode.includes(qq)) score = 50;
      else if ((p.name || "").toLowerCase().includes(qLower)) score = 40;
      else if ((p.name_zh || "").includes(q)) score = 45;
      else if ((p.country || "") === qq || (p.country || "").toLowerCase() === qLower) score = 20;
      else continue;
      if (p.depth === "deep") score += 5;
      scored.push({ type: "port", p, score });
    }
    for (const t of DATA.topicsIndex.topics || []) {
      let score = 0;
      if ((t.id || "").toLowerCase().includes(qLower)) score = 70;
      else if ((t.title_zh || "").includes(q)) score = 75;
      else if ((t.title_en || "").toLowerCase().includes(qLower)) score = 65;
      else continue;
      scored.push({ type: "topic", t, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 40);
    if (!top.length) {
      el.hits.style.display = "block";
      el.hits.innerHTML = '<button type="button" disabled>No matches</button>';
      return;
    }
    el.hits.style.display = "block";
    el.hits.innerHTML = top
      .map((row) => {
        if (row.type === "topic") {
          const t = row.t;
          return `<button type="button" data-topic="${esc(t.id)}"><span class="locode">TOPIC</span>${esc(t.title_zh)} <span class="thin">${esc(t.product_use || "")}</span></button>`;
        }
        const p = row.p;
        const zh = p.name_zh ? " · " + esc(p.name_zh) : "";
        return `<button type="button" data-locode="${esc(p.locode)}"><span class="locode">${esc(p.locode)}</span>${esc(p.name)}${zh} <span class="${p.depth}">${p.depth}</span></button>`;
      })
      .join("");
    el.hits.querySelectorAll("button[data-locode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const port = DATA.ports.find((x) => x.locode === btn.dataset.locode);
        if (port) {
          el.hits.style.display = "none";
          flyTo(port);
          openPort(port);
        }
      });
    });
    el.hits.querySelectorAll("button[data-topic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        el.hits.style.display = "none";
        openTopic(btn.dataset.topic);
      });
    });
  }

  function flyTo(p) {
    if (!globe) return;
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: p.lat, lng: p.lon, altitude: 1.35 }, 1000);
  }

  function topicsForPort(p) {
    const list = DATA.topicsIndex.topics || [];
    const out = [];
    for (const t of list) {
      const ports = t.port_hooks || [];
      const countries = t.country_hooks || [];
      if (ports.includes(p.locode) || countries.includes(p.country)) out.push(t);
    }
    // Always suggest core commercial clocks + VGM
    const always = ["T01_demurrage_detention_storage_freetime", "T02_vgm_solas"];
    for (const id of always) {
      if (!out.find((x) => x.id === id)) {
        const t = list.find((x) => x.id === id);
        if (t) out.push(t);
      }
    }
    return out;
  }

  function chipClass(use) {
    if (use === "market_yellow") return "topic-chip market";
    if (use === "deep_field") return "topic-chip deep";
    return "topic-chip";
  }

  function renderRelatedTopics(p) {
    const rel = topicsForPort(p);
    if (!rel.length) return "";
    let html = `<h4 style="margin:12px 0 4px;font-size:11px;color:#c084fc;text-transform:uppercase;letter-spacing:.06em">Related · 关注主题</h4>`;
    html += `<div class="topic-chips">`;
    rel.forEach((t) => {
      html += `<button type="button" class="${chipClass(t.product_use)}" data-open-topic="${esc(t.id)}">${esc(t.title_zh)}</button>`;
    });
    html += `</div>`;
    return html;
  }

  function bindTopicChips(root) {
    root.querySelectorAll("[data-open-topic]").forEach((btn) => {
      btn.addEventListener("click", () => openTopic(btn.getAttribute("data-open-topic")));
    });
  }

  function openPort(p) {
    lastPort = p;
    selected = p;
    activeLayer = "foundation";
    el.btnFoundation.classList.add("active");
    el.btnAttention.classList.remove("active");
    el.panel.classList.remove("hidden");
    const zh = p.name_zh ? " · " + p.name_zh : "";
    el.panelTitle.textContent = p.name + zh;
    const country = DATA.countries[p.country];
    const pack = DATA.packs[p.locode];
    el.panelMeta.innerHTML =
      `<span class="badge ${p.depth}">${p.depth}</span>` +
      `<span>${esc(p.locode)}</span>` +
      `<span>${esc(p.country)}</span>` +
      (country
        ? `<span class="badge ${country.depth || "skeleton"}">${esc(country.depth || "skeleton")} country</span>`
        : `<span class="badge thin">no country pack</span>`) +
      (pack ? `<span class="badge deep">Port Pack</span>` : "");

    el.panelBody.innerHTML =
      renderRelatedTopics(p) +
      renderConventionLayer() +
      renderCountryLayer(p, country) +
      renderPortLayer(p, pack) +
      renderCarrierLayer(pack, country);
    bindTopicChips(el.panelBody);
  }

  function openTopicBrowser() {
    el.panel.classList.remove("hidden");
    el.panelTitle.textContent = "关注层 · Attention topics";
    el.panelMeta.innerHTML =
      `<span class="badge deep">${(DATA.topicsIndex.topics || []).length} topics</span>` +
      `<span>heat = X counts · referee = official</span>`;
    const cards = (DATA.topicsIndex.topics || [])
      .map((t) => {
        return (
          `<button type="button" class="topic-card" data-open-topic="${esc(t.id)}">` +
          `<div class="tid">${esc(t.id)}</div>` +
          `<div class="tzh">${esc(t.title_zh)}</div>` +
          `<div class="ten">${esc(t.title_en)}</div>` +
          `<div class="meta-row"><span class="use-tag">${esc(t.product_use || "")}</span>` +
          `<span class="use-tag">${esc(t.confidence || "")}</span></div>` +
          `</button>`
        );
      })
      .join("");
    el.panelBody.innerHTML =
      `<div class="empty" style="margin-bottom:8px">详尽基础知识包（定义 / 责任 / FAQ / 官方出处）。热度只排序，不编造罚金。</div>` +
      `<div class="topic-list">${cards}</div>`;
    bindTopicChips(el.panelBody);
  }

  function openTopic(id) {
    const t = DATA.topics[id];
    if (!t) {
      openTopicBrowser();
      return;
    }
    activeLayer = "attention";
    el.btnAttention.classList.add("active");
    el.btnFoundation.classList.remove("active");
    el.panel.classList.remove("hidden");
    el.panelTitle.textContent = t.title_zh || id;
    el.panelMeta.innerHTML =
      `<span class="badge deep">attention</span>` +
      `<span class="use-tag">${esc(t.product_use || "")}</span>` +
      `<span class="use-tag">${esc(t.confidence || "")}</span>` +
      `<span>as_of ${esc(t.as_of || "")}</span>`;

    let html = `<button type="button" class="back-topics" id="backTopics">← 全部主题</button>`;
    if (t.why_attention && t.why_attention.summary_zh) {
      html += `<div>${esc(t.why_attention.summary_zh)}</div>`;
    }
    if (t.why_attention && t.why_attention.heat_7d) {
      html += `<div style="margin-top:6px">`;
      Object.entries(t.why_attention.heat_7d).forEach(([k, v]) => {
        html += `<span class="heat-pill" style="margin-right:4px">${esc(k)}: ${esc(String(v))}</span>`;
      });
      html += `</div>`;
    }

    html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Definitions</h4><ul>`;
    (t.definitions || []).forEach((d) => {
      html += `<li><strong>${esc(d.term)}</strong>${d.zh ? "（" + esc(d.zh) + "）" : ""} — ${esc(d.def)}</li>`;
    });
    html += `</ul>`;

    html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Who pays / responsible</h4>`;
    if (t.who_pays) {
      html += `<div>${esc(t.who_pays.typical || "")}</div>`;
      if (t.who_pays.note) html += `<div class="empty">${esc(t.who_pays.note)}</div>`;
    }
    if (t.who_responsible && t.who_responsible.length) {
      html += `<ul>`;
      t.who_responsible.forEach((r) => (html += `<li>${esc(r)}</li>`));
      html += `</ul>`;
    }

    html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Pitfalls</h4><ul>`;
    (t.common_pitfalls || []).forEach((p) => (html += `<li>${esc(p)}</li>`));
    html += `</ul>`;

    html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Official sources</h4>`;
    (t.official_sources || []).forEach((s) => {
      html += `<div><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.org || s.url)}</a> — ${esc(s.note || "")}</div>`;
    });

    if (t.country_hooks && t.country_hooks.length) {
      html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Country hooks</h4><ul>`;
      t.country_hooks.forEach((c) => {
        html += `<li><strong>${esc(c.iso2)}</strong> ${esc(c.note || "")}</li>`;
      });
      html += `</ul>`;
    }

    if (t.port_hooks && t.port_hooks.length) {
      html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Port hooks</h4><div class="topic-chips">`;
      t.port_hooks.forEach((ph) => {
        html += `<button type="button" class="topic-chip deep" data-goto-port="${esc(ph.locode)}">${esc(ph.locode)}</button>`;
      });
      html += `</div>`;
    }

    html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">FAQ</h4>`;
    (t.faq || []).forEach((f) => {
      html += `<div class="faq-block"><div class="q">Q: ${esc(f.q)}</div><div class="a">${esc(f.a)}</div></div>`;
    });

    if (t.x_evidence) {
      html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">X evidence (heat)</h4>`;
      if (t.x_evidence.honesty) html += `<div class="empty">${esc(t.x_evidence.honesty)}</div>`;
      (t.x_evidence.samples || []).forEach((s) => {
        html += `<div><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a> <span class="use-tag">${esc(s.kind || "")}</span></div>`;
      });
      if (t.x_evidence.rumor_unverified && t.x_evidence.rumor_unverified.length) {
        html += `<div class="commercial-tag">rumor_unverified: ${esc(t.x_evidence.rumor_unverified.join(" · "))}</div>`;
      }
    }

    if (t.gaps && t.gaps.length) {
      html += `<h4 style="margin:12px 0 4px;font-size:11px;color:var(--lime-dim);text-transform:uppercase">Gaps</h4><ul>`;
      t.gaps.forEach((g) => (html += `<li class="empty">${esc(g)}</li>`));
      html += `</ul>`;
    }

    html += `<div style="margin-top:10px;font-size:11px;color:var(--muted)">${esc(t.disclaimer || "")}</div>`;

    el.panelBody.innerHTML = html;
    const back = document.getElementById("backTopics");
    if (back) back.addEventListener("click", openTopicBrowser);
    bindTopicChips(el.panelBody);
    el.panelBody.querySelectorAll("[data-goto-port]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const port = DATA.ports.find((x) => x.locode === btn.getAttribute("data-goto-port"));
        if (port) {
          flyTo(port);
          openPort(port);
        }
      });
    });
  }

  function renderConventionLayer() {
    const items = (DATA.conventions && DATA.conventions.items) || [];
    const body = items.length
      ? items
          .map(
            (it) =>
              `<div style="margin-bottom:10px"><strong>${esc(it.title_zh || it.title)}</strong>` +
              `<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">${esc(it.id)}${it.effective ? " · " + esc(it.effective) : ""}</div>` +
              `<div>${esc(it.summary_zh || it.summary)}</div>` +
              (it.sources || [])
                .map((u) => `<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`)
                .join("") +
              `</div>`
          )
          .join("")
      : `<div class="empty">待核实 · conventions missing</div>`;
    return acc("L1", "公约 Convention", "SOLAS / CTU / CSC / ISPM15 / IMDG", body, false);
  }

  function renderCountryLayer(p, country) {
    if (!country) {
      return acc(
        "L2",
        "国家 Country",
        p.country + " · 薄",
        `<div class="empty">该国尚无国别规则包（skeleton 待扩）。点开港仅有 UN/LOCODE 坐标。</div>`,
        true
      );
    }
    let html = "";
    html += `<h4>Profile</h4><div>${esc(country.name)}${country.name_zh ? " · " + esc(country.name_zh) : ""} · <span class="badge ${country.depth}">${esc(country.depth)}</span> · as_of ${esc(country.as_of)} · confidence ${esc(country.confidence)}</div>`;
    if (country.fine_profile) html += `<div>fine_profile: <code>${esc(country.fine_profile)}</code></div>`;

    if (country.vgm) {
      html += `<h4>VGM</h4><ul>`;
      html += `<li>required_for_load: <strong>${country.vgm.required_for_load ? "YES / 无 VGM 不得装船" : "—"}</strong></li>`;
      if (country.vgm.tolerance_note) html += `<li>${esc(country.vgm.tolerance_note)}</li>`;
      if (country.vgm.statute) html += `<li>statute: ${esc(country.vgm.statute)}</li>`;
      (country.vgm.sources || []).forEach((u) => {
        html += `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`;
      });
      html += `</ul>`;
    }

    if (country.road_limits) {
      html += `<h4>Road / 公路限重</h4>`;
      if (country.road_limits.statute) html += `<div>${esc(country.road_limits.statute)}</div>`;
      if (country.road_limits.note) html += `<div>${esc(country.road_limits.note)}</div>`;
      if (country.road_limits.jbi_note) html += `<div>${esc(country.road_limits.jbi_note)}</div>`;
      if (country.road_limits.table_kg) {
        html += `<ul>`;
        Object.entries(country.road_limits.table_kg).forEach(([k, v]) => {
          html += `<li>${esc(k)}: <strong>${Number(v).toLocaleString()} kg</strong></li>`;
        });
        html += `</ul>`;
      }
      if (country.road_limits.mst_t) {
        html += `<ul>`;
        Object.entries(country.road_limits.mst_t).forEach(([k, v]) => {
          html += `<li>${esc(k)} MST: <strong>${v} t</strong></li>`;
        });
        html += `</ul>`;
      }
      (country.road_limits.sources || []).forEach((u) => {
        html += `<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`;
      });
    }

    if (country.fine_refs && country.fine_refs.length) {
      html += `<h4>Fine refs · 有出处罚则</h4><ul>`;
      country.fine_refs.forEach((f) => {
        html += `<li><strong>${esc(f.id)}</strong>`;
        if (f.cap != null) html += ` · cap ${esc(f.currency || "")} ${Number(f.cap).toLocaleString()}`;
        if (f.formula_note) html += `<div>${esc(f.formula_note)}</div>`;
        (f.sources || []).forEach((u) => {
          html += `<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`;
        });
        html += `</li>`;
      });
      html += `</ul>`;
    } else if (country.depth === "skeleton") {
      html += `<h4>Fine refs</h4><div class="empty">骨架国 · 金额待核实，不编造</div>`;
    }

    if (country.checklists && country.checklists.length) {
      html += `<h4>Checklists</h4><ul>`;
      country.checklists.forEach((c) => {
        html += `<li><span class="sev ${esc(c.severity || "info")}">${esc(c.severity || "info")}</span>${esc(c.title || c.id)}</li>`;
      });
      html += `</ul>`;
    }

    if (country.notes && country.notes.length) {
      html += `<h4>Notes / 诚实边界</h4><ul>`;
      country.notes.forEach((n) => (html += `<li>${esc(n)}</li>`));
      html += `</ul>`;
    }

    html += `<div style="margin-top:8px;font-size:11px;color:var(--muted)">${esc(country.disclaimer || "")}</div>`;

    return acc("L2", "国家 Country", country.name + (country.name_zh ? " · " + country.name_zh : ""), html, true);
  }

  function renderPortLayer(p, pack) {
    if (!pack) {
      return acc(
        "L3",
        "港 Port Pack",
        "薄 / thin",
        `<div class="empty">此港仅有 UN/LOCODE 坐标与国别（若有）。尚无深 Port Pack。不编造 stuffing 禁令。</div>
         <div>functions: <code>${esc(p.functions || "—")}</code></div>
         <div>lat/lon: ${p.lat}, ${p.lon}</div>`,
        false
      );
    }
    let html = "";
    html += `<h4>Pack</h4><div>tier ${esc(pack.tier || "—")} · confidence ${esc(pack.confidence || "—")} · as_of ${esc(pack.as_of)}</div>`;
    if (pack.fine_profile) html += `<div>fine_profile: <code>${esc(pack.fine_profile)}</code></div>`;
    if (pack.stuffing_ban_machine_readable === false) {
      html += `<div class="empty">stuffing_ban_machine_readable: false — 未见机器可读柜内摆法禁令</div>`;
    }
    if (pack.vgm) {
      html += `<h4>VGM (port)</h4><ul>`;
      html += `<li>required: ${pack.vgm.required_for_load ? "yes" : "—"}</li>`;
      if (pack.vgm.via) html += `<li>via: ${esc(pack.vgm.via)}</li>`;
      if (pack.vgm.tolerance_note) html += `<li>${esc(pack.vgm.tolerance_note)}</li>`;
      if (pack.vgm.statute) html += `<li>${esc(pack.vgm.statute)}</li>`;
      html += `</ul>`;
    }
    if (pack.checklists && pack.checklists.length) {
      html += `<h4>Checklists</h4><ul>`;
      pack.checklists.forEach((c) => {
        html += `<li><span class="sev ${esc(c.severity || "info")}">${esc(c.severity || "info")}</span>${esc(c.title || c.id)}`;
        if (c.detail) html += `<div style="opacity:.85">${esc(c.detail)}</div>`;
        html += `</li>`;
      });
      html += `</ul>`;
    }
    if (pack.fine_refs && pack.fine_refs.length) {
      html += `<h4>Fine refs</h4><ul>`;
      pack.fine_refs.forEach((f) => {
        html += `<li><strong>${esc(f.id)}</strong>`;
        if (f.cap != null) html += ` · ${esc(f.currency || "")} ${Number(f.cap).toLocaleString()}`;
        if (f.formula_note) html += `<div>${esc(f.formula_note)}</div>`;
        (f.sources || []).forEach((u) => {
          html += `<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`;
        });
        html += `</li>`;
      });
      html += `</ul>`;
    }
    if (pack.flags && Object.keys(pack.flags).length) {
      html += `<h4>Flags</h4><ul>`;
      Object.entries(pack.flags).forEach(([k, v]) => {
        html += `<li>${esc(k)}: ${esc(String(v))}</li>`;
      });
      html += `</ul>`;
    }
    if (pack.notes && pack.notes.length) {
      html += `<h4>Notes</h4><ul>`;
      pack.notes.forEach((n) => (html += `<li>${esc(n)}</li>`));
      html += `</ul>`;
    }
    if (pack.sources && pack.sources.length) {
      html += `<h4>Sources</h4>`;
      pack.sources.forEach((s) => {
        const u = typeof s === "string" ? s : s.url;
        if (u) html += `<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`;
      });
    }
    return acc("L3", "港 Port Pack", pack.port_id + " · " + (pack.dossier_depth || "deep"), html, false);
  }

  function renderCarrierLayer(pack, country) {
    const hints = (pack && pack.commercial_cost_hints) || [];
    const countryFees = (country && country.carrier_fees_examples) || [];
    const all = hints.concat(countryFees);
    let html = `<div class="commercial-tag">商业条款 / Carrier accessorial ≠ 行政罚 Administrative fine</div>`;
    if (!all.length) {
      html += `<div class="empty" style="margin-top:8px">本港暂无已核实承运人费例。甩柜/搬移/滞箱属船司码头条款，勿与治超行政罚混写。</div>`;
    } else {
      html += `<ul style="margin-top:8px">`;
      all.forEach((h) => {
        html += `<li><strong>${esc(h.carrier || h.id || h.type || "fee")}</strong>`;
        if (h.amount_usd != null) html += ` · USD ${h.amount_usd}/${esc(h.per || "ctr")}`;
        if (h.note) html += `<div>${esc(h.note)}</div>`;
        if (h.type) html += `<div style="font-family:var(--mono);font-size:11px;color:var(--muted)">type: ${esc(h.type)}</div>`;
        (h.sources || []).forEach((u) => {
          html += `<div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`;
        });
        html += `</li>`;
      });
      html += `</ul>`;
    }
    return acc("L4", "承运人费 Carrier fees", "commercial only", html, false);
  }

  function acc(layer, title, hint, bodyHtml, openDefault) {
    return (
      `<details class="acc"${openDefault ? " open" : ""}>` +
      `<summary><span class="layer">${esc(layer)}</span>${esc(title)}<span class="hint">${esc(hint)}</span></summary>` +
      `<div class="content">${bodyHtml}</div>` +
      `</details>`
    );
  }

  boot().catch((err) => {
    console.error(err);
    el.stats.textContent = "Failed to load data — use a local HTTP server (see README)";
    el.footerDisc.textContent =
      "Error: " + err.message + " · Open via: python3 -m http.server 8765 (from globe/)";
  });
})();
