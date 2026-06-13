// ============================================================
//  SIPBB – Frontend / App Layer
//  Tampilan mengikuti estetika index.html:
//  - Hero dengan metric cards besar
//  - Dusun tabs di bawah hero
//  - Analytics cards per RW & RT (expandable)
// ============================================================

"use strict";

import {
  TAHUN_LIST, DUSUN_DATA,
  wpData, pendingList, riwayatList, petugasList,
  currentUser, login, logout as doLogout,
  processApproval, submitPayment, addWP, addPetugas,
  getStats, getTrenData, getDusunStats, getRWStats, getRTStats,
  searchWP, getTunggakanList, getPendingApprovals,
} from "./data.js";

// ─── CHART REGISTRY ─────────────────────────────────────────
const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// ─── HELPERS ─────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function rp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

function statusBadge(s) {
  if (s === "lunas")   return `<span class="bdg bdg-rt">Lunas</span>`;
  if (s === "pending") return `<span class="bdg bdg-ds">Pending</span>`;
  return `<span class="bdg bdg-luar">Tunggakan</span>`;
}

function shortNOP(nop) {
  if (!nop) return "—";
  return nop.length > 16 ? nop.substring(0, 14) + "…" : nop;
}

export function toast(msg, type = "") {
  const wrap = el("toast-wrap");
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  const icon = type === "err" ? "❌" : type === "warn" ? "⚠️" : "✅";
  t.textContent = icon + " " + msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s, transform .3s";
    t.style.opacity = "0";
    t.style.transform = "translateX(20px)";
    setTimeout(() => t.remove(), 320);
  }, 3500);
}

function counter(elId, target, isRp, dur = 800) {
  const node = el(elId);
  if (!node) return;
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min((now - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    const v = Math.round(target * e);
    node.textContent = isRp ? rp(v) : v.toLocaleString("id-ID");
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

// ─── NAVIGATION ──────────────────────────────────────────────
let _currentPage = "public";
let _activeDusun = 0; // 0 = all, 1-7 = dusun index

export function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = el("page-" + pageId);
  if (!target) return;
  target.classList.add("active");
  _currentPage = pageId;

  const loggedIn = !!currentUser;
  el("btn-nav-login").style.display  = loggedIn ? "none" : "";
  el("btn-nav-logout").style.display = loggedIn ? "" : "none";

  if (pageId === "app" && currentUser) refreshAppData();
}

const NAV_MAP = {
  "dashboard":            "nav-dashboard",
  "data-wp":              "nav-data-wp",
  "approval":             "nav-approval",
  "rekap":                "nav-rekap",
  "riwayat":              "nav-riwayat",
  "petugas":              "nav-petugas",
  "dashboard-petugas":    "nav-dp",
  "bayar-wp":             "nav-bayar",
  "riwayat-petugas":      "nav-rp",
};

export function showSection(id) {
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
  const section = el("section-" + id);
  if (section) section.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navId = NAV_MAP[id];
  if (navId && el(navId)) el(navId).classList.add("active");

  const renders = {
    "rekap":             buildRekapTable,
    "approval":          buildApprovalTable,
    "riwayat":           buildRiwayatTable,
    "petugas":           buildPetugasTable,
    "data-wp":           buildWPTable,
    "dashboard-petugas": buildPetugasDashboard,
    "riwayat-petugas":   buildRiwayatPetugas,
  };
  if (renders[id]) renders[id]();
}

function refreshAppData() {
  setupSidebar();
  if (currentUser.role === "admin") {
    showSection("dashboard");
    buildAdminDashboard();
  } else {
    showSection("dashboard-petugas");
    buildPetugasDashboard();
  }
}

// ─── AUTH ────────────────────────────────────────────────────
export function doLogin() {
  const role = el("login-role").value;
  const user = el("login-user").value.trim();
  const pass = el("login-pass").value;
  const found = login(role, user, pass);
  if (!found) { toast("Username atau password salah!", "err"); return; }
  setupSidebar();
  showPage("app");
  toast(`Selamat datang, ${found.nama}! 👋`);
}

export function handleLogout() {
  doLogout();
  showPage("public");
  toast("Berhasil keluar");
}

export function quickLogin(role, user, pass) {
  el("login-role").value = role;
  el("login-user").value = user;
  el("login-pass").value = pass;
}

function setupSidebar() {
  const u = currentUser;
  el("sb-avatar").textContent = u.nama[0].toUpperCase();
  el("sb-name").textContent   = u.nama;
  el("sb-role").textContent   = u.role === "admin" ? "Admin Desa" : u.role === "rt" ? "Petugas RT" : "Kolektor";
  const badge = el("sb-badge");
  badge.textContent = u.role.toUpperCase();
  badge.className   = "role-pill " + (u.role === "admin" ? "pill-admin" : u.role === "rt" ? "pill-rt" : "pill-kolektor");
  el("menu-admin").style.display   = u.role === "admin" ? "" : "none";
  el("menu-petugas").style.display = u.role !== "admin" ? "" : "none";
  refreshApprovalBadge();
}

function refreshApprovalBadge() {
  const count = getPendingApprovals().length;
  const badge = el("badge-approval");
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? "" : "none"; }
}

// ─── PUBLIC INIT ─────────────────────────────────────────────
function initPublic() {
  buildYearTabs();
  buildDusunTabs();
  buildRwCardsPublic(0);
  buildDusunGridPublic();
  buildPublicTable();
  buildPublicCharts();

  // Animate hero stats
  const s = getStats(2026);
  counter("pub-total-wp",  wpData.length, false, 1200);
  counter("pub-lunas",     s.lunas,       false, 1400);
  counter("pub-tunggakan", s.tunggak,     false, 1400);
  counter("pub-pending",   s.pending,     false, 1000);
  // Persen counter
  const pNode = el("pub-persen");
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min((now - t0) / 1600, 1);
    const v = Math.round(s.persen * (1 - Math.pow(1 - p, 3)));
    if (pNode) pNode.textContent = v + "%";
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

// ─── YEAR TABS ────────────────────────────────────────────────
function buildYearTabs() {
  const c = el("pub-year-tabs");
  if (!c) return;
  c.innerHTML = [...TAHUN_LIST].reverse().map((y, i) =>
    `<button class="ytab${i === 0 ? " active" : ""}" onclick="selectYearTab(${y}, this)">${y}</button>`
  ).join("");
}

window.selectYearTab = function(year, btn) {
  document.querySelectorAll(".ytab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
};

// ─── DUSUN TABS (style dari index.html) ──────────────────────
function buildDusunTabs() {
  const inner = el("dusun-inner");
  if (!inner) return;

  // Get stats per dusun
  const dusunStats = getDusunStats(2026);

  // "Semua" tab
  const allStats = getStats(2026);
  const tabs = [
    {
      id: 0,
      name: "🏘️ Semua Dusun",
      sub: "Seluruh wilayah",
      n: wpData.length + " WP",
      rp: allStats.persen + "% lunas",
    },
    ...dusunStats.map((d, i) => ({
      id: i + 1,
      name: "🌿 " + d.nama,
      sub: d.total + " WP",
      n: d.lunas + " lunas",
      rp: d.persen + "% lunas",
    })),
  ];

  inner.innerHTML = tabs.map(t => `
    <div class="dcard${t.id === 0 ? " on" : ""}" id="dtab-${t.id}" onclick="setDusunTab(${t.id})">
      <div class="dcard-name">${t.name}</div>
      <div class="dcard-rw">${t.sub}</div>
      <div class="dcard-n">${t.n}</div>
      <div class="dcard-rp">${t.rp}</div>
    </div>`
  ).join("");

  // Set dusun-inner columns
  inner.style.gridTemplateColumns = `repeat(${tabs.length}, 1fr)`;
}

window.setDusunTab = function(dusunIdx) {
  _activeDusun = dusunIdx;
  document.querySelectorAll(".dcard").forEach(d => d.classList.remove("on"));
  const tab = el("dtab-" + dusunIdx);
  if (tab) tab.classList.add("on");
  buildRwCardsPublic(dusunIdx);
  buildPublicTable();
};

// ─── RW ANALYTICS CARDS (public) ─────────────────────────────
function buildRwCardsPublic(dusunIdx) {
  const grid = el("rw-grid-pub");
  if (!grid) return;

  const dusunStats = getDusunStats(2026);

  // Determine which dusuns to show
  let dusuns;
  if (dusunIdx === 0) {
    dusuns = dusunStats;
  } else {
    dusuns = [dusunStats[dusunIdx - 1]];
  }

  const maxWP = Math.max(...dusuns.map(d => d.total), 1);

  grid.innerHTML = dusuns.map(d => {
    const pct = Math.round(d.total / maxWP * 100);
    const persen = d.persen;
    // RT breakdown
    const rtStats = getRTStats(2026);
    // filter RT by dusun (approximation: pick RTs from this dusun)
    const dIdx = dusunStats.indexOf(d);
    const dInfo = DUSUN_DATA[dIdx] || {};
    const rtRows = (dInfo.rt || []).map(rt => {
      const rs = rtStats[rt] || { lunas: 0, total: 1 };
      const rtPct = Math.round(rs.lunas / rs.total * 100);
      return `
        <div class="rt-row">
          <span class="rt-label">RT ${rt}</span>
          <div class="rt-bar-wrap"><div class="rt-bar" style="width:${rtPct}%"></div></div>
          <span class="rt-rp">${rs.lunas}/${rs.total}</span>
          <span class="rt-wp">${rtPct}%</span>
        </div>`;
    }).join("");

    return `
      <div class="rw-card" onclick="toggleRwCard(this, '${d.nama.replace(/\s/g,'_')}')">
        <div class="rw-card-head">
          <span class="rw-card-label">🏘️ ${d.nama}</span>
          <span class="rw-card-wp">${d.total} WP</span>
        </div>
        <div class="rw-card-rp" style="color:var(--h2)">${persen}% lunas</div>
        <div class="rw-card-bar-bg">
          <div class="rw-card-bar" style="width:${persen}%"></div>
        </div>
        <div class="rt-accordion" id="rta-${d.nama.replace(/\s/g,'_')}">
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--ab);margin-bottom:8px">
            <span>✅ Lunas: ${d.lunas}</span>
            <span>⏳ Pending: ${d.pending}</span>
            <span>⚠️ Tunggak: ${d.tunggak}</span>
          </div>
          ${rtRows}
        </div>
      </div>`;
  }).join("");
}

window.toggleRwCard = function(card, id) {
  const acc = el("rta-" + id);
  if (!acc) return;
  const isOpen = acc.classList.contains("open");
  document.querySelectorAll(".rt-accordion").forEach(a => a.classList.remove("open"));
  if (!isOpen) acc.classList.add("open");
};

// ─── RW ANALYTICS CARDS (admin) ──────────────────────────────
function buildRwCardsAdmin() {
  const grid = el("rw-grid-admin");
  if (!grid) return;

  const dusunStats = getDusunStats(2026);
  const maxWP = Math.max(...dusunStats.map(d => d.total), 1);

  grid.innerHTML = dusunStats.map(d => {
    const persen = d.persen;
    const rtStats = getRTStats(2026);
    const dIdx = dusunStats.indexOf(d);
    const dInfo = DUSUN_DATA[dIdx] || {};
    const rtRows = (dInfo.rt || []).map(rt => {
      const rs = rtStats[rt] || { lunas: 0, total: 1 };
      const rtPct = Math.round(rs.lunas / rs.total * 100);
      return `
        <div class="rt-row">
          <span class="rt-label">RT ${rt}</span>
          <div class="rt-bar-wrap"><div class="rt-bar" style="width:${rtPct}%"></div></div>
          <span class="rt-rp">${rs.lunas}/${rs.total}</span>
          <span class="rt-wp">${rtPct}%</span>
        </div>`;
    }).join("");

    return `
      <div class="rw-card" onclick="toggleRwCard(this, 'adm_${d.nama.replace(/\s/g,'_')}')">
        <div class="rw-card-head">
          <span class="rw-card-label">🏘️ ${d.nama}</span>
          <span class="rw-card-wp">${d.total} WP</span>
        </div>
        <div class="rw-card-rp" style="color:var(--h2)">${persen}% lunas</div>
        <div class="rw-card-bar-bg">
          <div class="rw-card-bar" style="width:${persen}%"></div>
        </div>
        <div class="rt-accordion" id="rta-adm_${d.nama.replace(/\s/g,'_')}">
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--ab);margin-bottom:8px">
            <span>✅ ${d.lunas}</span>
            <span>⏳ ${d.pending}</span>
            <span>⚠️ ${d.tunggak}</span>
          </div>
          ${rtRows}
        </div>
      </div>`;
  }).join("");
}

// ─── DUSUN GRID (public) ─────────────────────────────────────
function buildDusunGridPublic() {
  const g = el("dusun-grid-pub");
  if (!g) return;
  g.innerHTML = getDusunStats(2026).map(d => `
    <div class="dusun-card">
      <h4>🏘️ ${d.nama}</h4>
      <div class="dstat"><label>Total WP</label><strong>${d.total}</strong></div>
      <div class="dstat"><label>Lunas</label><strong style="color:var(--h2)">${d.lunas}</strong></div>
      <div class="dstat"><label>Pending</label><strong style="color:#d97706">${d.pending}</strong></div>
      <div class="dstat"><label>Tunggakan</label><strong style="color:var(--r)">${d.tunggak}</strong></div>
      <div class="dstat"><label>Progress</label><strong>${d.persen}%</strong></div>
      <div class="progress"><div class="progress-bar" style="width:${d.persen}%"></div></div>
    </div>`
  ).join("");
}

// ─── PUBLIC TABLE ─────────────────────────────────────────────
function buildPublicTable(query = "", filterStatus = "") {
  // filter by active dusun tab
  let data = searchWP(query, "", filterStatus, 80);
  if (_activeDusun > 0) {
    const dName = DUSUN_DATA[_activeDusun - 1]?.nama || "";
    data = data.filter(w => w.dusun === dName);
  }

  const tbody = el("pub-table-body");
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ab)">Data tidak ditemukan</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(w => {
    const tunggakYears = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
    const tunggakStr = tunggakYears.length
      ? `<div class="yrtags">${tunggakYears.map(y => `<span class="ytag">${y}</span>`).join("")}</div>`
      : `<span style="color:var(--h2);font-size:.75rem">✓ Bersih</span>`;
    return `<tr>
      <td class="nop">${shortNOP(w.nop)}</td>
      <td class="nm">${w.nama}</td>
      <td style="font-size:.78rem">${w.dusun}<br><span style="color:var(--ab)">RW ${w.rw} / RT ${w.rt}</span></td>
      <td>${statusBadge(w.payments[2024])}</td>
      <td>${statusBadge(w.payments[2025])}</td>
      <td>${statusBadge(w.payments[2026])}</td>
      <td>${tunggakStr}</td>
    </tr>`;
  }).join("");
}

window.pubSearch = function() {
  const q = el("pub-search")?.value || "";
  const s = el("pub-filter-status")?.value || "";
  buildPublicTable(q, s);
};

// ─── PUBLIC CHARTS ────────────────────────────────────────────
function buildPublicCharts() {
  const tren       = getTrenData();
  const dusunStats = getDusunStats(2026);
  const rtStats    = getRTStats(2026);
  const { lunas, pending, tunggak } = getStats(2026);

  // Tren line
  destroyChart("chart-tren");
  charts["chart-tren"] = new Chart(el("chart-tren").getContext("2d"), {
    type: "line",
    data: {
      labels: TAHUN_LIST.map(String),
      datasets: [{
        label: "% Lunas", data: tren,
        borderColor: "#1a5c3a", backgroundColor: "rgba(26,92,58,.09)",
        fill: true, tension: .4, pointBackgroundColor: "#c49a28", pointRadius: 4,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + "%" }, grid: { color: "#e5e7eb" } },
        x: { grid: { display: false } },
      }
    },
  });

  // Donut
  destroyChart("chart-donut");
  charts["chart-donut"] = new Chart(el("chart-donut").getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Lunas", "Pending", "Tunggakan"],
      datasets: [{ data: [lunas, pending, tunggak], backgroundColor: ["#1a5c3a", "#c49a28", "#dc2626"], borderWidth: 0, hoverOffset: 8 }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { padding: 14, font: { size: 12 } } } }
    },
  });

  // Per Dusun bar
  destroyChart("chart-rw");
  charts["chart-rw"] = new Chart(el("chart-rw").getContext("2d"), {
    type: "bar",
    data: {
      labels: dusunStats.map(d => d.nama.replace("Dusun ", "")),
      datasets: [
        { label: "Lunas",     data: dusunStats.map(d => d.lunas),   backgroundColor: "#1a5c3a", borderRadius: 3 },
        { label: "Tunggakan", data: dusunStats.map(d => d.tunggak), backgroundColor: "#dc2626", borderRadius: 3 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: "#e5e7eb" } } },
    },
  });

  // Per RT bar
  const rtKeys = Object.keys(rtStats).sort().slice(0, 10);
  destroyChart("chart-rt");
  charts["chart-rt"] = new Chart(el("chart-rt").getContext("2d"), {
    type: "bar",
    data: {
      labels: rtKeys.map(r => "RT " + r),
      datasets: [{ label: "% Lunas", data: rtKeys.map(r => Math.round(rtStats[r].lunas / rtStats[r].total * 100)), backgroundColor: "rgba(26,92,58,.8)", borderRadius: 4 }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" }, grid: { color: "#e5e7eb" } }, x: { grid: { display: false } } },
    },
  });
}

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────
function buildAdminDashboard() {
  const s = getStats(2026);
  if (el("kpi-lunas"))    el("kpi-lunas").textContent    = s.lunas;
  if (el("kpi-tunggak"))  el("kpi-tunggak").textContent  = s.tunggak;
  if (el("kpi-pending"))  el("kpi-pending").textContent  = s.pending;
  if (el("kpi-total-wp")) el("kpi-total-wp").textContent = wpData.length;

  const tren       = getTrenData();
  const dusunStats = getDusunStats(2026);

  // Analytics cards
  buildRwCardsAdmin();

  destroyChart("admin-chart-tren");
  charts["admin-chart-tren"] = new Chart(el("admin-chart-tren").getContext("2d"), {
    type: "line",
    data: { labels: TAHUN_LIST.map(String), datasets: [{ label: "% Lunas", data: tren, borderColor: "#1a5c3a", backgroundColor: "rgba(26,92,58,.09)", fill: true, tension: .4, pointBackgroundColor: "#c49a28", pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" }, grid: { color: "#e5e7eb" } }, x: { grid: { display: false } } }
    },
  });

  destroyChart("admin-chart-dusun");
  charts["admin-chart-dusun"] = new Chart(el("admin-chart-dusun").getContext("2d"), {
    type: "bar",
    data: {
      labels: dusunStats.map(d => d.nama.replace("Dusun ", "")),
      datasets: [
        { label: "Lunas",     data: dusunStats.map(d => d.lunas),   backgroundColor: "#1a5c3a", borderRadius: 4 },
        { label: "Tunggakan", data: dusunStats.map(d => d.tunggak), backgroundColor: "#dc2626", borderRadius: 4 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "#e5e7eb" } } }
    },
  });

  buildPendingPreview();
}

function buildPendingPreview() {
  const pending = getPendingApprovals().slice(0, 5);
  const wrap = el("admin-pending-preview");
  if (!wrap) return;
  if (!pending.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Tidak ada pembayaran yang menunggu persetujuan</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th style="text-align:left">Tanggal</th><th>NOP</th><th>Nama WP</th><th>Tahun</th><th>Petugas</th><th>Aksi</th></tr></thead>
        <tbody>
          ${pending.map(p => `
          <tr>
            <td>${p.tanggal}</td>
            <td class="nop">${shortNOP(p.nop)}</td>
            <td class="nm">${p.nama}</td>
            <td><strong>${p.tahun}</strong></td>
            <td>${p.petugas}</td>
            <td>
              <button class="btn btn-success btn-sm" onclick="approveItem(${p.id}, true)">✓ Approve</button>
              <button class="btn btn-danger btn-sm" onclick="approveItem(${p.id}, false)" style="margin-left:4px">✕</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

// ─── ADMIN: DATA WP ───────────────────────────────────────────
function buildWPTable() {
  const q      = el("admin-search-wp")?.value || "";
  const dusun  = el("filter-dusun")?.value    || "";
  const status = el("filter-status-wp")?.value || "";
  const data   = searchWP(q, dusun, status, 100);

  const tbody = el("admin-wp-tbody");
  if (!tbody) return;

  tbody.innerHTML = data.map(w => {
    const tunggakCount = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan").length;
    return `<tr>
      <td class="nop">${shortNOP(w.nop)}</td>
      <td class="nm">${w.nama}</td>
      <td>${w.dusun}</td><td>RW ${w.rw}</td><td>RT ${w.rt}</td>
      <td>${statusBadge(w.payments[2026])}</td>
      <td>${tunggakCount ? `<span style="color:var(--r);font-size:.8rem;font-weight:600">${tunggakCount} tahun</span>` : `<span style="color:var(--h2);font-size:.8rem">Bersih</span>`}</td>
      <td><button class="btn-pb" onclick="showDetailWP(${w.id})">Detail</button></td>
    </tr>`;
  }).join("");
}

window.filterWP = buildWPTable;

window.showDetailWP = function(id) {
  const w = wpData.find(x => x.id === id);
  if (!w) return;
  const tunggak = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
  el("modal-wp-content").innerHTML = `
    ${tunggak.length ? `<div class="alert alert-danger"><div class="alert-icon">⚠️</div><div><h4>Memiliki Tunggakan</h4><p>Belum lunas: ${tunggak.join(", ")}</p></div></div>` : ""}
    <div class="info-row"><label>NOP</label><strong class="mono">${w.nop}</strong></div>
    <div class="info-row"><label>Nama WP</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>Dusun</label><strong>${w.dusun}</strong></div>
    <div class="info-row"><label>RW / RT</label><strong>RW ${w.rw} / RT ${w.rt}</strong></div>
    <h4 style="margin:20px 0 12px;font-size:.9rem">Riwayat Pembayaran</h4>
    <div class="table-wrap"><table>
      <thead><tr><th style="text-align:left">Tahun</th><th>Status</th></tr></thead>
      <tbody>${[...TAHUN_LIST].reverse().map(y => `<tr><td><strong>${y}</strong></td><td>${statusBadge(w.payments[y])}</td></tr>`).join("")}</tbody>
    </table></div>`;
  openModal("modal-detail-wp");
};

// ─── ADMIN: APPROVAL ─────────────────────────────────────────
function buildApprovalTable() {
  const tbody = el("approval-tbody");
  if (!tbody) return;
  tbody.innerHTML = pendingList.map(p => `
    <tr>
      <td>${p.tanggal}</td>
      <td class="nop">${shortNOP(p.nop)}</td>
      <td class="nm">${p.nama}</td>
      <td><strong>${p.tahun}</strong></td>
      <td>${p.petugas}</td>
      <td><button class="btn-pb" onclick="viewBukti(${p.id})">📎 Lihat</button></td>
      <td>${p.status === "pending" ? '<span class="bdg bdg-ds">Pending</span>' : p.status === "lunas" ? '<span class="bdg bdg-rt">Approved</span>' : '<span class="bdg bdg-luar">Rejected</span>'}</td>
      <td>${p.status === "pending"
        ? `<button class="btn btn-success btn-sm" onclick="approveItem(${p.id},true)">✓</button> <button class="btn btn-danger btn-sm" onclick="approveItem(${p.id},false)">✕</button>`
        : `<span style="font-size:.78rem;color:var(--ab)">${p.ketAdmin}</span>`
      }</td>
    </tr>`
  ).join("");
}

window.approveItem = function(id, approved) {
  const result = processApproval(id, approved, currentUser.nama);
  if (!result) return;
  toast(approved ? "✅ Pembayaran disetujui!" : "❌ Pembayaran ditolak", approved ? "" : "err");
  buildApprovalTable();
  buildPendingPreview();
  refreshApprovalBadge();
  const s = getStats(2026);
  if (el("kpi-lunas"))   el("kpi-lunas").textContent   = s.lunas;
  if (el("kpi-tunggak")) el("kpi-tunggak").textContent = s.tunggak;
  if (el("kpi-pending")) el("kpi-pending").textContent = s.pending;
  buildPublicTable();
  buildDusunGridPublic();
};

window.viewBukti = function(id) {
  const p = pendingList.find(x => x.id === id);
  if (!p) return;
  el("modal-bukti-content").innerHTML = `
    <div class="info-row"><label>NOP</label><strong>${p.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${p.nama}</strong></div>
    <div class="info-row"><label>Tahun</label><strong>${p.tahun}</strong></div>
    <div class="info-row"><label>Petugas</label><strong>${p.petugas}</strong></div>
    ${p.buktiUrl
      ? `<img src="${p.buktiUrl}" style="width:100%;border-radius:10px;margin-top:16px">`
      : `<div style="margin-top:16px;text-align:center;background:var(--bg);border-radius:10px;padding:40px"><div style="font-size:3rem">📎</div><p style="color:var(--ab);margin-top:8px;font-size:.875rem">Pratinjau tidak tersedia (demo)</p></div>`
    }
    ${p.status === "pending" ? `
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-success" style="flex:1" onclick="approveItem(${p.id},true);closeModal('modal-bukti')">✓ Approve</button>
      <button class="btn btn-danger"  style="flex:1" onclick="approveItem(${p.id},false);closeModal('modal-bukti')">✕ Reject</button>
    </div>` : ""}`;
  openModal("modal-bukti");
};

// ─── ADMIN: REKAP TUNGGAKAN ───────────────────────────────────
function buildRekapTable() {
  const data = getTunggakanList();
  if (el("rek-total")) el("rek-total").textContent = data.length;
  if (el("rek-1th"))   el("rek-1th").textContent   = data.filter(w => TAHUN_LIST.filter(y => w.payments[y] === "tunggakan").length === 1).length;
  if (el("rek-multi")) el("rek-multi").textContent  = data.filter(w => TAHUN_LIST.filter(y => w.payments[y] === "tunggakan").length > 1).length;

  const tbody = el("rekap-tbody");
  if (!tbody) return;
  tbody.innerHTML = data.slice(0, 100).map(w => {
    const t = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
    return `<tr>
      <td class="nop">${shortNOP(w.nop)}</td>
      <td class="nm">${w.nama}</td>
      <td style="font-size:.78rem">${w.dusun} / RW ${w.rw} / RT ${w.rt}</td>
      <td><div class="yrtags">${t.map(y => `<span class="ytag">${y}</span>`).join("")}</div></td>
      <td><span class="bdg bdg-luar">${t.length} thn</span></td>
      <td><button class="btn-pb" onclick="showDetailWP(${w.id})">Detail</button></td>
    </tr>`;
  }).join("");
}

// ─── ADMIN: RIWAYAT ───────────────────────────────────────────
function buildRiwayatTable() {
  const tbody = el("riwayat-tbody");
  if (!tbody) return;
  tbody.innerHTML = riwayatList.map(r => `
    <tr>
      <td>${r.tglLunas}</td>
      <td class="nop">${shortNOP(r.nop)}</td>
      <td class="nm">${r.nama}</td>
      <td><strong>${r.tahun}</strong></td>
      <td>${r.petugas}</td>
      <td><span class="bdg bdg-rt">${r.approvedBy}</span></td>
    </tr>`
  ).join("");
}

// ─── ADMIN: PETUGAS ───────────────────────────────────────────
function buildPetugasTable() {
  const tbody = el("petugas-tbody");
  if (!tbody) return;
  tbody.innerHTML = petugasList.map(p => `
    <tr>
      <td class="nm">${p.nama}</td>
      <td class="mono">${p.username}</td>
      <td><span class="bdg ${p.role === "rt" ? "b-approved" : "b-lunas"}">${p.role.toUpperCase()}</span></td>
      <td style="font-size:.78rem">${p.wilayah}</td>
      <td>${p.totalUpload}</td>
      <td>
        <button class="btn-pb" onclick="toast('Edit: ${p.nama}')">Edit</button>
        <button class="btn-und" onclick="toast('Hapus: ${p.nama}','err')" style="margin-left:4px">Hapus</button>
      </td>
    </tr>`
  ).join("");
}

// ─── MODAL TAMBAH ─────────────────────────────────────────────
window.openModalTambahWP = () => openModal("modal-tambah-wp");
window.openModalTambahPetugas = () => openModal("modal-tambah-petugas");

window.simpanWP = function() {
  const nop   = el("twp-nop")?.value.trim();
  const nama  = el("twp-nama")?.value.trim();
  const dusun = el("twp-dusun")?.value;
  const rw    = el("twp-rw")?.value.trim();
  const rt    = el("twp-rt")?.value.trim();
  if (!nop || !nama || !rw || !rt) { toast("Lengkapi semua field!", "err"); return; }
  addWP({ nop, nama, dusun, rw, rt });
  toast(`WP berhasil ditambahkan: ${nama}`);
  closeModal("modal-tambah-wp");
  buildWPTable();
};

window.simpanPetugas = function() {
  const nama     = el("tp-nama")?.value.trim();
  const username = el("tp-user")?.value.trim();
  const password = el("tp-pass")?.value;
  const role     = el("tp-role")?.value;
  const wilayah  = el("tp-wilayah")?.value.trim();
  if (!nama || !username || !password) { toast("Lengkapi data petugas!", "err"); return; }
  addPetugas({ nama, username, password, role, wilayah });
  toast(`Petugas berhasil ditambahkan: ${nama}`);
  closeModal("modal-tambah-petugas");
  buildPetugasTable();
};

// ─── PETUGAS: DASHBOARD ───────────────────────────────────────
function buildPetugasDashboard() {
  if (!currentUser) return;
  const greeting = el("petugas-greeting");
  if (greeting) greeting.textContent = `Halo, ${currentUser.nama} — ${currentUser.wilayah || "Semua Wilayah"}`;

  const myWP = wpData.slice(0, 80);
  const s = { lunas: 0, belum: 0, pending: 0 };
  myWP.forEach(w => {
    const st = w.payments[2026];
    if (st === "lunas")      s.lunas++;
    else if (st === "pending") s.pending++;
    else                     s.belum++;
  });

  if (el("pet-lunas"))   el("pet-lunas").textContent   = s.lunas;
  if (el("pet-belum"))   el("pet-belum").textContent   = s.belum;
  if (el("pet-pending")) el("pet-pending").textContent = s.pending;
  if (el("pet-total"))   el("pet-total").textContent   = myWP.length;

  const tbody = el("petugas-wp-tbody");
  if (tbody) {
    tbody.innerHTML = myWP
      .filter(w => w.payments[2026] !== "lunas")
      .slice(0, 25)
      .map(w => `
        <tr>
          <td class="nop">${shortNOP(w.nop)}</td>
          <td class="nm">${w.nama}</td>
          <td>${statusBadge(w.payments[2026])}</td>
          <td><button class="btn-pb" onclick="prefillBayar(${w.id})">Input Bayar</button></td>
        </tr>`)
      .join("");
  }
}

window.prefillBayar = function(id) {
  _selectedBayarWP = wpData.find(w => w.id === id);
  showSection("bayar-wp");
  if (_selectedBayarWP) {
    const s = el("bayar-search");
    if (s) s.value = _selectedBayarWP.nama;
    showBayarInfo(_selectedBayarWP);
  }
};

// ─── PETUGAS: INPUT BAYAR ─────────────────────────────────────
let _selectedBayarWP   = null;
let _selectedBayarFile = null;

window.searchBayarWP = function() {
  const q = el("bayar-search")?.value.toLowerCase() || "";
  const resultDiv = el("bayar-wp-result");
  if (!resultDiv) return;
  if (!q) { resultDiv.innerHTML = ""; return; }

  const results = wpData.filter(w => w.nama.toLowerCase().includes(q) || w.nop.includes(q)).slice(0, 6);
  if (!results.length) { resultDiv.innerHTML = `<p style="font-size:.8rem;color:var(--ab);padding:8px">Tidak ditemukan</p>`; return; }

  resultDiv.innerHTML = `
    <div style="border:1px solid var(--br);border-radius:10px;overflow:hidden;box-shadow:var(--s1)">
      ${results.map(w => `
        <div class="bayar-result-item" style="padding:10px 14px;cursor:pointer;font-size:.84rem;border-bottom:1px solid var(--br)" onclick="selectBayarWP(${w.id})">
          <strong>${w.nama}</strong>
          <span style="color:var(--ab);font-size:.78rem"> — ${shortNOP(w.nop)} — ${w.dusun} RT ${w.rt}</span>
          <div style="margin-top:4px">${statusBadge(w.payments[2026])}</div>
        </div>`
      ).join("")}
    </div>`;
};

window.selectBayarWP = function(id) {
  _selectedBayarWP = wpData.find(w => w.id === id);
  const s = el("bayar-search");
  if (s) s.value = _selectedBayarWP.nama;
  const r = el("bayar-wp-result");
  if (r) r.innerHTML = "";
  showBayarInfo(_selectedBayarWP);
};

function showBayarInfo(w) {
  const tunggak = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
  const div = el("bayar-info-detail");
  if (!div) return;
  div.innerHTML = `
    ${tunggak.length ? `<div class="alert alert-warn"><div class="alert-icon">⚠️</div><div><h4>Ada Tunggakan</h4><p>Tahun: ${tunggak.join(", ")}</p></div></div>` : ""}
    <div class="info-row"><label>NOP</label><strong class="mono" style="font-size:.78rem">${w.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>Lokasi</label><strong>${w.dusun} / RW ${w.rw} / RT ${w.rt}</strong></div>
    <div class="info-row"><label>Status 2026</label><strong>${statusBadge(w.payments[2026])}</strong></div>
    <div style="margin-top:16px">
      <p style="font-size:.8rem;font-weight:700;color:var(--ab);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Status per tahun</p>
      ${[...TAHUN_LIST].reverse().map(y => `<div class="info-row"><label>${y}</label><strong>${statusBadge(w.payments[y])}</strong></div>`).join("")}
    </div>`;
}

window.previewBukti = function(input) {
  _selectedBayarFile = input.files[0];
  if (_selectedBayarFile) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = el("bukti-preview");
      if (img) { img.src = e.target.result; img.style.display = "block"; }
    };
    reader.readAsDataURL(_selectedBayarFile);
  }
};

window.submitBayar = function() {
  if (!_selectedBayarWP) { toast("Pilih wajib pajak terlebih dahulu!", "err"); return; }
  const tahun = parseInt(el("bayar-tahun")?.value);
  const currentStatus = _selectedBayarWP.payments[tahun];
  if (currentStatus === "lunas")   { toast("WP ini sudah lunas untuk tahun " + tahun, "warn"); return; }
  if (currentStatus === "pending") { toast("Sudah ada pengajuan pending untuk tahun " + tahun, "warn"); return; }

  submitPayment({ wpId: _selectedBayarWP.id, tahun, petugasNama: currentUser.nama, file: _selectedBayarFile });
  toast("✅ Bukti bayar diupload! Menunggu approval admin.");

  _selectedBayarWP = null; _selectedBayarFile = null;
  const bs = el("bayar-search"); if (bs) bs.value = "";
  const br = el("bayar-wp-result"); if (br) br.innerHTML = "";
  const bd = el("bayar-info-detail");
  if (bd) bd.innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Upload berhasil! Menunggu approval Admin Desa.</p></div>`;
  const bp = el("bukti-preview"); if (bp) bp.style.display = "none";
};

// ─── PETUGAS: RIWAYAT UPLOAD ──────────────────────────────────
function buildRiwayatPetugas() {
  const tbody = el("riwayat-petugas-tbody");
  if (!tbody) return;
  const myItems = pendingList.filter(p => p.petugas === currentUser?.nama).slice(0, 50);
  tbody.innerHTML = myItems.length
    ? myItems.map(p => `
        <tr>
          <td>${p.tanggal}</td>
          <td class="nop">${shortNOP(p.nop)}</td>
          <td class="nm">${p.nama}</td>
          <td><strong>${p.tahun}</strong></td>
          <td>${p.status === "pending" ? '<span class="bdg bdg-ds">Menunggu</span>' : p.status === "lunas" ? '<span class="bdg bdg-rt">Approved</span>' : '<span class="bdg bdg-luar">Ditolak</span>'}</td>
          <td style="font-size:.78rem;color:var(--ab)">${p.ketAdmin || "—"}</td>
        </tr>`)
      .join("")
    : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--ab)">Belum ada riwayat upload</td></tr>`;
}

// ─── MODALS ───────────────────────────────────────────────────
export function openModal(id)  { el(id)?.classList.add("open"); }
export function closeModal(id) { el(id)?.classList.remove("open"); }

window.openModal  = openModal;
window.closeModal = closeModal;

document.querySelectorAll(".modal-overlay").forEach(m =>
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); })
);

// ─── EXPOSE GLOBALS ───────────────────────────────────────────
window.showPage     = showPage;
window.showSection  = showSection;
window.doLogin      = doLogin;
window.handleLogout = handleLogout;
window.quickLogin   = quickLogin;
window.toast        = toast;

// ─── BOOT ─────────────────────────────────────────────────────
window.addEventListener("load", () => {
  setTimeout(() => {
    const ls = el("loading-screen");
    if (ls) {
      ls.style.opacity = "0";
      setTimeout(() => { ls.style.display = "none"; initPublic(); }, 600);
    }
  }, 1800);

  const ham = el("hamburger");
  const sb  = el("sidebar");
  if (ham && sb) ham.addEventListener("click", () => sb.classList.toggle("open"));
  el("login-pass")?.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
});
