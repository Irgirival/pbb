// ============================================================
//  SIPBB – Frontend / App Layer
//  Hanya UI: render, event handler, chart, toast.
//  Semua data/logika bisnis dipanggil dari data.js
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

function statusBadge(s) {
  if (s === "lunas")     return `<span class="badge b-lunas">Lunas</span>`;
  if (s === "pending")   return `<span class="badge b-pending">Pending</span>`;
  return `<span class="badge b-tunggak">Tunggakan</span>`;
}

function shortNOP(nop) { return nop.substring(0, 14) + "…"; }

let toastTimer = {};
export function toast(msg, type = "") {
  const wrap = el("toast-wrap");
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  const icon = type === "err" ? "❌" : type === "warn" ? "⚠️" : "✅";
  t.textContent = icon + " " + msg;
  wrap.appendChild(t);
  const id = setTimeout(() => {
    t.style.transition = "opacity .3s, transform .3s";
    t.style.opacity = "0"; t.style.transform = "translateX(20px)";
    setTimeout(() => t.remove(), 320);
  }, 3500);
}

export function animateCount(elId, target) {
  const node = el(elId);
  if (!node) return;
  let cur = 0;
  const step = Math.ceil(target / 50);
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    node.textContent = cur.toLocaleString("id-ID");
    if (cur >= target) clearInterval(iv);
  }, 20);
}

// ─── NAVIGATION ──────────────────────────────────────────────
let _currentPage = "public";

export function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
  });

  const target = el("page-" + pageId);
  if (!target) return;
  target.classList.add("active");
  _currentPage = pageId;

  // Update navbar visibility
  const loggedIn = !!currentUser;
  el("btn-nav-login").style.display  = loggedIn ? "none" : "";
  el("btn-nav-logout").style.display = loggedIn ? "" : "none";

  if (pageId === "app" && currentUser) refreshAppData();
  if (pageId === "global") initGlobalDashboard();
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

  // Lazy-render per section
  const renders = {
    "rekap":              buildRekapTable,
    "approval":           buildApprovalTable,
    "riwayat":            buildRiwayatTable,
    "petugas":            buildPetugasTable,
    "data-wp":            buildWPTable,
    "dashboard-petugas":  buildPetugasDashboard,
    "riwayat-petugas":    buildRiwayatPetugas,
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
  buildDusunGrid();
  buildPublicTable();
  buildPublicCharts();

  // Animate hero stats
  const s = getStats(2026);
  animateCount("pub-total-wp",  wpData.length);
  animateCount("pub-lunas",     s.lunas);
  animateCount("pub-tunggakan", s.tunggak);
  animateCount("pub-pending",   s.pending);
  el("pub-persen").textContent = s.persen + "%";
}

// ─── YEAR TABS ────────────────────────────────────────────────
function buildYearTabs() {
  const c = el("pub-year-tabs");
  c.innerHTML = [...TAHUN_LIST].reverse().map((y, i) =>
    `<button class="ytab${i === 0 ? " active" : ""}" onclick="selectYearTab(${y}, this)">${y}</button>`
  ).join("");
}

window.selectYearTab = function(year, btn) {
  document.querySelectorAll(".ytab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  // Optional: re-render charts for selected year
};

// ─── DUSUN GRID ───────────────────────────────────────────────
function buildDusunGrid() {
  const g = el("dusun-grid");
  g.innerHTML = getDusunStats(2026).map(d => `
    <div class="dusun-card">
      <h4>🏘️ ${d.nama}</h4>
      <div class="dstat"><label>Total WP</label><strong>${d.total}</strong></div>
      <div class="dstat"><label>Lunas</label><strong style="color:var(--c-brand)">${d.lunas}</strong></div>
      <div class="dstat"><label>Pending</label><strong style="color:var(--c-warn)">${d.pending}</strong></div>
      <div class="dstat"><label>Tunggakan</label><strong style="color:var(--c-danger)">${d.tunggak}</strong></div>
      <div class="dstat"><label>Progress</label><strong>${d.persen}%</strong></div>
      <div class="progress"><div class="progress-bar" style="width:${d.persen}%"></div></div>
    </div>`
  ).join("");
}

// ─── PUBLIC TABLE ─────────────────────────────────────────────
function buildPublicTable(query = "", filterStatus = "") {
  const data = searchWP(query, "", filterStatus, 60);
  const tbody = el("pub-table-body");

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--c-muted)">Data tidak ditemukan</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(w => {
    const tunggakYears = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
    const tunggakStr   = tunggakYears.length
      ? `<span style="color:var(--c-danger);font-size:.75rem">${tunggakYears.join(", ")}</span>`
      : `<span style="color:var(--c-brand);font-size:.75rem">✓ Bersih</span>`;
    return `<tr>
      <td class="mono">${shortNOP(w.nop)}</td>
      <td><strong>${w.nama}</strong></td>
      <td><span style="font-size:.78rem">${w.dusun}<br>RW ${w.rw} / RT ${w.rt}</span></td>
      <td>${statusBadge(w.payments[2024])}</td>
      <td>${statusBadge(w.payments[2025])}</td>
      <td>${statusBadge(w.payments[2026])}</td>
      <td>${tunggakStr}</td>
    </tr>`;
  }).join("");
}

window.pubSearch = function() {
  const q = el("pub-search").value;
  const s = el("pub-filter-status").value;
  buildPublicTable(q, s);
};

// ─── PUBLIC CHARTS ────────────────────────────────────────────
function buildPublicCharts() {
  const tren = getTrenData();
  const rwStats = getRWStats(2026);
  const rtStats = getRTStats(2026);
  const { lunas, pending, tunggak } = getStats(2026);

  // Tren
  destroyChart("chart-tren");
  charts["chart-tren"] = new Chart(el("chart-tren").getContext("2d"), {
    type: "line",
    data: {
      labels: TAHUN_LIST.map(String),
      datasets: [{
        label: "% Lunas", data: tren,
        borderColor: "#198c55", backgroundColor: "rgba(25,140,85,.09)",
        fill: true, tension: .4, pointBackgroundColor: "#198c55", pointRadius: 4,
      }],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ min:0,max:100,ticks:{ callback:v=>v+"%" },grid:{ color:"#dce5de" } }, x:{ grid:{ display:false } } } },
  });

  // Donut
  destroyChart("chart-donut");
  charts["chart-donut"] = new Chart(el("chart-donut").getContext("2d"), {
    type: "doughnut",
    data: { labels:["Lunas","Pending","Tunggakan"], datasets:[{ data:[lunas,pending,tunggak], backgroundColor:["#198c55","#d97706","#d93025"], borderWidth:0, hoverOffset:8 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"bottom", labels:{ padding:14, font:{ size:12 } } } } },
  });

  // Per RW
  const rwKeys = Object.keys(rwStats).sort().slice(0, 10);
  destroyChart("chart-rw");
  charts["chart-rw"] = new Chart(el("chart-rw").getContext("2d"), {
    type: "bar",
    data: { labels: rwKeys.map(r=>"RW "+r), datasets:[
      { label:"Lunas",     data:rwKeys.map(r=>rwStats[r].lunas),   backgroundColor:"#198c55", borderRadius:3 },
      { label:"Tunggakan", data:rwKeys.map(r=>rwStats[r].tunggak), backgroundColor:"#d93025", borderRadius:3 },
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"bottom" } },
      scales:{ x:{ stacked:true, grid:{ display:false } }, y:{ stacked:true, grid:{ color:"#dce5de" } } } },
  });

  // Per RT
  const rtKeys = Object.keys(rtStats).sort().slice(0, 10);
  destroyChart("chart-rt");
  charts["chart-rt"] = new Chart(el("chart-rt").getContext("2d"), {
    type: "bar",
    data: { labels: rtKeys.map(r=>"RT "+r), datasets:[{
      label: "% Lunas",
      data: rtKeys.map(r => Math.round(rtStats[r].lunas / rtStats[r].total * 100)),
      backgroundColor: "rgba(14,107,63,.8)", borderRadius: 4,
    }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ min:0,max:100,ticks:{ callback:v=>v+"%" },grid:{ color:"#dce5de" } }, x:{ grid:{ display:false } } } },
  });
}

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────
function buildAdminDashboard() {
  const s = getStats(2026);
  el("kpi-lunas").textContent   = s.lunas;
  el("kpi-tunggak").textContent = s.tunggak;
  el("kpi-pending").textContent = s.pending;

  const tren       = getTrenData();
  const dusunStats = getDusunStats(2026);

  destroyChart("admin-chart-tren");
  charts["admin-chart-tren"] = new Chart(el("admin-chart-tren").getContext("2d"), {
    type: "line",
    data:{ labels:TAHUN_LIST.map(String), datasets:[{ label:"% Lunas", data:tren, borderColor:"#198c55", backgroundColor:"rgba(25,140,85,.09)", fill:true, tension:.4, pointBackgroundColor:"#198c55", pointRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ min:0,max:100, ticks:{ callback:v=>v+"%" }, grid:{ color:"#dce5de" } }, x:{ grid:{ display:false } } } },
  });

  destroyChart("admin-chart-dusun");
  charts["admin-chart-dusun"] = new Chart(el("admin-chart-dusun").getContext("2d"), {
    type: "bar",
    data:{ labels: dusunStats.map(d=>d.nama.replace("Dusun ","")), datasets:[
      { label:"Lunas",     data:dusunStats.map(d=>d.lunas),   backgroundColor:"#198c55", borderRadius:4 },
      { label:"Tunggakan", data:dusunStats.map(d=>d.tunggak), backgroundColor:"#d93025", borderRadius:4 },
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"bottom" } },
      scales:{ x:{ grid:{ display:false } }, y:{ grid:{ color:"#dce5de" } } } },
  });

  buildPendingPreview();
}

function buildPendingPreview() {
  const pending = getPendingApprovals().slice(0, 5);
  const wrap = el("admin-pending-preview");
  if (!pending.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Tidak ada pembayaran yang menunggu persetujuan</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>NOP</th><th>Nama WP</th><th>Tahun</th><th>Petugas</th><th>Aksi</th></tr></thead>
        <tbody>
          ${pending.map(p => `
          <tr>
            <td>${p.tanggal}</td>
            <td class="mono">${shortNOP(p.nop)}</td>
            <td><strong>${p.nama}</strong></td>
            <td><strong>${p.tahun}</strong></td>
            <td>${p.petugas}</td>
            <td>
              <button class="btn btn-success btn-sm" onclick="approveItem(${p.id}, true)">✓ Approve</button>
              <button class="btn btn-danger btn-sm"  onclick="approveItem(${p.id}, false)" style="margin-left:4px">✕</button>
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

  el("admin-wp-tbody").innerHTML = data.map(w => {
    const tunggakCount = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan").length;
    return `<tr>
      <td class="mono">${shortNOP(w.nop)}</td>
      <td><strong>${w.nama}</strong></td>
      <td>${w.dusun}</td><td>RW ${w.rw}</td><td>RT ${w.rt}</td>
      <td>${statusBadge(w.payments[2026])}</td>
      <td>${tunggakCount ? `<span style="color:var(--c-danger);font-size:.8rem">${tunggakCount} tahun</span>` : `<span style="color:var(--c-brand);font-size:.8rem">Bersih</span>`}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showDetailWP(${w.id})">Detail</button></td>
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
      <thead><tr><th>Tahun</th><th>Status</th></tr></thead>
      <tbody>${[...TAHUN_LIST].reverse().map(y => `<tr><td><strong>${y}</strong></td><td>${statusBadge(w.payments[y])}</td></tr>`).join("")}</tbody>
    </table></div>`;
  openModal("modal-detail-wp");
};

// ─── ADMIN: APPROVAL ─────────────────────────────────────────
function buildApprovalTable() {
  el("approval-tbody").innerHTML = pendingList.map(p => `
    <tr>
      <td>${p.tanggal}</td>
      <td class="mono">${shortNOP(p.nop)}</td>
      <td><strong>${p.nama}</strong></td>
      <td><strong>${p.tahun}</strong></td>
      <td>${p.petugas}</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewBukti(${p.id})">📎 Lihat</button></td>
      <td>${p.status === "pending" ? '<span class="badge b-pending">Pending</span>' : p.status === "lunas" ? '<span class="badge b-lunas">Approved</span>' : '<span class="badge b-tunggak">Rejected</span>'}</td>
      <td>${p.status === "pending"
        ? `<button class="btn btn-success btn-sm" onclick="approveItem(${p.id},true)">✓</button> <button class="btn btn-danger btn-sm" onclick="approveItem(${p.id},false)">✕</button>`
        : `<span style="font-size:.78rem;color:var(--c-muted)">${p.ketAdmin}</span>`
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
  // Update KPI
  const s = getStats(2026);
  if (el("kpi-lunas"))   el("kpi-lunas").textContent   = s.lunas;
  if (el("kpi-tunggak")) el("kpi-tunggak").textContent = s.tunggak;
  if (el("kpi-pending")) el("kpi-pending").textContent = s.pending;
  buildPublicTable(); buildDusunGrid();
};

window.viewBukti = function(id) {
  const p = pendingList.find(x => x.id === id);
  el("modal-bukti-content").innerHTML = `
    <div class="info-row"><label>NOP</label><strong>${p.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${p.nama}</strong></div>
    <div class="info-row"><label>Tahun</label><strong>${p.tahun}</strong></div>
    <div class="info-row"><label>Petugas</label><strong>${p.petugas}</strong></div>
    ${p.buktiUrl
      ? `<img src="${p.buktiUrl}" style="width:100%;border-radius:var(--r-md);margin-top:16px">`
      : `<div style="margin-top:16px;text-align:center;background:var(--c-bg);border-radius:var(--r-md);padding:40px"><div style="font-size:3rem">📎</div><p style="color:var(--c-muted);margin-top:8px;font-size:.875rem">Pratinjau tidak tersedia (demo)</p></div>`
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
  el("rek-total").textContent = data.length;
  el("rek-1th").textContent   = data.filter(w => TAHUN_LIST.filter(y => w.payments[y] === "tunggakan").length === 1).length;
  el("rek-multi").textContent = data.filter(w => TAHUN_LIST.filter(y => w.payments[y] === "tunggakan").length > 1).length;

  el("rekap-tbody").innerHTML = data.slice(0, 100).map(w => {
    const t = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
    return `<tr>
      <td class="mono">${shortNOP(w.nop)}</td>
      <td><strong>${w.nama}</strong></td>
      <td><span style="font-size:.78rem">${w.dusun} / RW ${w.rw} / RT ${w.rt}</span></td>
      <td><span style="color:var(--c-danger);font-weight:600;font-size:.83rem">${t.join(", ")}</span></td>
      <td><span class="badge b-tunggak">${t.length} thn</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="showDetailWP(${w.id})">Detail</button></td>
    </tr>`;
  }).join("");
}

// ─── ADMIN: RIWAYAT ───────────────────────────────────────────
function buildRiwayatTable() {
  const fromDate = el("riwayat-from-date")?.value;
  const toDate = el("riwayat-to-date")?.value;
  const filterPetugas = el("riwayat-filter-petugas")?.value || "";
  
  // Populate petugas dropdown if empty
  const petugasSelect = el("riwayat-filter-petugas");
  if (petugasSelect && petugasSelect.options.length === 1) {
    const uniquePetugas = [...new Set(riwayatList.map(r => r.petugas))];
    uniquePetugas.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      petugasSelect.appendChild(opt);
    });
  }
  
  // Filter data based on date range and petugas
  let filteredData = riwayatList.filter(r => {
    // Parse tanggal dari format DD/MM/YYYY ke Date object
    const parts = r.tglLunas.split("/");
    const rDate = new Date(parts[2], parts[1] - 1, parts[0]);
    
    let matchDate = true;
    if (fromDate) {
      const from = new Date(fromDate);
      if (rDate < from) matchDate = false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (rDate > to) matchDate = false;
    }
    
    const matchPetugas = !filterPetugas || r.petugas === filterPetugas;
    
    return matchDate && matchPetugas;
  });
  
  el("riwayat-tbody").innerHTML = filteredData.length
    ? filteredData.map(r => `
        <tr>
          <td>${r.tglLunas}</td>
          <td class="mono">${shortNOP(r.nop)}</td>
          <td><strong>${r.nama}</strong></td>
          <td><strong>${r.tahun}</strong></td>
          <td>${r.petugas}</td>
          <td><span class="badge b-lunas">${r.approvedBy}</span></td>
        </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--c-muted)">Tidak ada data untuk periode yang dipilih</td></tr>`;
}

// Export Riwayat to Excel/CSV
window.exportRiwayat = function() {
  const fromDate = el("riwayat-from-date")?.value;
  const toDate = el("riwayat-to-date")?.value;
  const filterPetugas = el("riwayat-filter-petugas")?.value || "";
  
  let filteredData = riwayatList.filter(r => {
    const parts = r.tglLunas.split("/");
    const rDate = new Date(parts[2], parts[1] - 1, parts[0]);
    
    let matchDate = true;
    if (fromDate) {
      const from = new Date(fromDate);
      if (rDate < from) matchDate = false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (rDate > to) matchDate = false;
    }
    
    const matchPetugas = !filterPetugas || r.petugas === filterPetugas;
    return matchDate && matchPetugas;
  });
  
  if (!filteredData.length) {
    toast("Tidak ada data untuk diekspor", "warn");
    return;
  }
  
  // Create CSV content
  let csv = "Tanggal,NOP,Nama WP,Tahun,Petugas,Disetujui Oleh\n";
  filteredData.forEach(r => {
    csv += `${r.tglLunas},"${r.nop}","${r.nama}",${r.tahun},"${r.petugas}","${r.approvedBy}"\n`;
  });
  
  // Download file
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `riwayat_pbb_${fromDate || "all"}_to_${toDate || "all"}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast(`✅ Berhasil mengekspor ${filteredData.length} data`);
};

// ─── ADMIN: PETUGAS ───────────────────────────────────────────
function buildPetugasTable() {
  el("petugas-tbody").innerHTML = petugasList.map(p => `
    <tr>
      <td><strong>${p.nama}</strong></td>
      <td class="mono">${p.username}</td>
      <td><span class="badge ${p.role === "rt" ? "b-approved" : "b-lunas"}">${p.role.toUpperCase()}</span></td>
      <td style="font-size:.78rem">${p.wilayah}</td>
      <td>${p.totalUpload}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="toast('Edit: ${p.nama}')">Edit</button>
        <button class="btn btn-danger btn-sm"  onclick="toast('Hapus: ${p.nama}','err')" style="margin-left:4px">Hapus</button>
      </td>
    </tr>`
  ).join("");
}

// ─── MODALS: TAMBAH WP / PETUGAS ─────────────────────────────
window.openModalTambahWP = () => openModal("modal-tambah-wp");
window.openModalTambahPetugas = () => openModal("modal-tambah-petugas");

window.simpanWP = function() {
  const nop   = el("twp-nop").value.trim();
  const nama  = el("twp-nama").value.trim();
  const dusun = el("twp-dusun").value;
  const rw    = el("twp-rw").value.trim();
  const rt    = el("twp-rt").value.trim();
  if (!nop || !nama || !rw || !rt) { toast("Lengkapi semua field!", "err"); return; }
  addWP({ nop, nama, dusun, rw, rt });
  toast(`WP berhasil ditambahkan: ${nama}`);
  closeModal("modal-tambah-wp");
  buildWPTable();
};

window.simpanPetugas = function() {
  const nama    = el("tp-nama").value.trim();
  const username = el("tp-user").value.trim();
  const password = el("tp-pass").value;
  const role    = el("tp-role").value;
  const wilayah = el("tp-wilayah").value.trim();
  if (!nama || !username || !password) { toast("Lengkapi data petugas!", "err"); return; }
  addPetugas({ nama, username, password, role, wilayah });
  toast(`Petugas berhasil ditambahkan: ${nama}`);
  closeModal("modal-tambah-petugas");
  buildPetugasTable();
};

// ─── PETUGAS: DASHBOARD ───────────────────────────────────────
function buildPetugasDashboard() {
  if (!currentUser) return;
  el("petugas-greeting").textContent = `Halo, ${currentUser.nama} — ${currentUser.wilayah || "Semua Wilayah"}`;

  // Filter WP berdasarkan wilayah petugas (RT/RW)
  let myWP = [];
  
  if (currentUser.role === "rt") {
    // Petugas RT hanya melihat WP dari RT-nya saja
    const rtMatch = currentUser.wilayah.match(/RT\s*(\d+)/i);
    const rtNumber = rtMatch ? rtMatch[1].padStart(3, '0') : "";
    
    myWP = wpData.filter(w => {
      if (rtNumber && w.rt !== rtNumber) return false;
      return true;
    });
  } else if (currentUser.role === "kolektor") {
    // Kolektor bisa melihat semua WP
    myWP = wpData;
  } else {
    myWP = wpData.slice(0, 80);
  }
  
  const s = { lunas:0, belum:0, pending:0 };
  myWP.forEach(w => {
    const st = w.payments[2026];
    if (st === "lunas")     s.lunas++;
    else if (st === "pending") s.pending++;
    else                    s.belum++;
  });

  el("pet-lunas").textContent   = s.lunas;
  el("pet-belum").textContent   = s.belum;
  el("pet-pending").textContent = s.pending;
  el("pet-total").textContent   = myWP.length;

  el("petugas-wp-tbody").innerHTML = myWP
    .filter(w => w.payments[2026] !== "lunas")
    .slice(0, 50)
    .map(w => `
      <tr>
        <td class="mono">${shortNOP(w.nop)}</td>
        <td><strong>${w.nama}</strong></td>
        <td>${w.dusun}</td>
        <td>RW ${w.rw}</td>
        <td>RT ${w.rt}</td>
        <td>${statusBadge(w.payments[2026])}</td>
        <td><button class="btn btn-primary btn-sm" onclick="prefillBayar(${w.id})">Input Bayar</button></td>
      </tr>`)
    .join("");
}

window.prefillBayar = function(id) {
  _selectedBayarWP = wpData.find(w => w.id === id);
  showSection("bayar-wp");
  if (_selectedBayarWP) {
    el("bayar-search").value = _selectedBayarWP.nama;
    showBayarInfo(_selectedBayarWP);
  }
};

// ─── PETUGAS: INPUT BAYAR ─────────────────────────────────────
let _selectedBayarWP   = null;
let _selectedBayarFile = null;

window.searchBayarWP = function() {
  const q = el("bayar-search").value.toLowerCase();
  const resultDiv = el("bayar-wp-result");
  if (!q) { resultDiv.innerHTML = ""; return; }

  const results = wpData.filter(w => w.nama.toLowerCase().includes(q) || w.nop.includes(q)).slice(0, 6);
  if (!results.length) { resultDiv.innerHTML = `<p style="font-size:.8rem;color:var(--c-muted);padding:8px">Tidak ditemukan</p>`; return; }

  resultDiv.innerHTML = `
    <div style="border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;box-shadow:var(--shadow-sm)">
      ${results.map(w => `
        <div class="bayar-result-item" style="padding:10px 14px;cursor:pointer;font-size:.84rem;border-bottom:1px solid var(--c-border)" onclick="selectBayarWP(${w.id})">
          <strong>${w.nama}</strong>
          <span style="color:var(--c-muted);font-size:.78rem"> — ${shortNOP(w.nop)} — ${w.dusun} RT ${w.rt}</span>
          <div style="margin-top:4px">${statusBadge(w.payments[2026])}</div>
        </div>`
      ).join("")}
    </div>`;

  // hover effect via JS
  resultDiv.querySelectorAll(".bayar-result-item").forEach(item => {
    item.addEventListener("mouseenter", () => item.style.background = "var(--c-bg)");
    item.addEventListener("mouseleave", () => item.style.background = "");
  });
};

window.selectBayarWP = function(id) {
  _selectedBayarWP = wpData.find(w => w.id === id);
  el("bayar-search").value = _selectedBayarWP.nama;
  el("bayar-wp-result").innerHTML = "";
  showBayarInfo(_selectedBayarWP);
};

function showBayarInfo(w) {
  const tunggak = TAHUN_LIST.filter(y => w.payments[y] === "tunggakan");
  el("bayar-info-detail").innerHTML = `
    ${tunggak.length ? `<div class="alert alert-warn"><div class="alert-icon">⚠️</div><div><h4>Ada Tunggakan</h4><p>Tahun: ${tunggak.join(", ")}</p></div></div>` : ""}
    <div class="info-row"><label>NOP</label><strong class="mono" style="font-size:.78rem">${w.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>Lokasi</label><strong>${w.dusun} / RW ${w.rw} / RT ${w.rt}</strong></div>
    <div class="info-row"><label>Status 2026</label><strong>${statusBadge(w.payments[2026])}</strong></div>
    <div style="margin-top:16px">
      <p style="font-size:.8rem;font-weight:700;color:var(--c-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Status per tahun</p>
      ${[...TAHUN_LIST].reverse().map(y => `<div class="info-row"><label>${y}</label><strong>${statusBadge(w.payments[y])}</strong></div>`).join("")}
    </div>`;
}

window.previewBukti = function(input) {
  _selectedBayarFile = input.files[0];
  if (_selectedBayarFile) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = el("bukti-preview");
      img.src = e.target.result;
      img.style.display = "block";
    };
    reader.readAsDataURL(_selectedBayarFile);
  }
};

// Toggle tampilan berdasarkan metode pembayaran
window.toggleMetodeBayar = function() {
  const metode = el("bayar-metode").value;
  const uploadArea = el("upload-area");
  const uploadText = uploadArea.querySelector(".upload-text");
  
  if (metode === "bank") {
    uploadText.innerHTML = "Klik atau seret foto bukti transfer/struk ATM<br><small>JPG, PNG, maks 5 MB</small>";
  } else if (metode === "kolektor") {
    uploadText.innerHTML = "Klik atau seret foto bukti bayar ke kolektor<br><small>JPG, PNG, maks 5 MB</small>";
  } else {
    uploadText.innerHTML = "Klik atau seret foto bukti bayar<br><small>JPG, PNG, maks 5 MB</small>";
  }
};

window.submitBayar = function() {
  if (!_selectedBayarWP) { toast("Pilih wajib pajak terlebih dahulu!", "err"); return; }
  const tahun = parseInt(el("bayar-tahun").value);
  const currentStatus = _selectedBayarWP.payments[tahun];
  if (currentStatus === "lunas") { toast("WP ini sudah lunas untuk tahun " + tahun, "warn"); return; }
  if (currentStatus === "pending") { toast("Sudah ada pengajuan pending untuk tahun " + tahun, "warn"); return; }
  
  // Ambil metode pembayaran
  const metode = el("bayar-metode").value;
  const keteranganTambahan = metode === "bank" ? " (Via Bank)" : metode === "kolektor" ? " (Via Kolektor)" : " (Via RT)";
  
  submitPayment({ wpId: _selectedBayarWP.id, tahun, petugasNama: currentUser.nama + keteranganTambahan, file: _selectedBayarFile });
  toast("✅ Bukti bayar diupload! Menunggu approval admin.");

  _selectedBayarWP = null; _selectedBayarFile = null;
  el("bayar-search").value = "";
  el("bayar-wp-result").innerHTML = "";
  el("bayar-info-detail").innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Upload berhasil! Menunggu approval Admin Desa.</p></div>`;
  el("bukti-preview").style.display = "none";
};

// ─── PETUGAS: RIWAYAT UPLOAD ──────────────────────────────────
function buildRiwayatPetugas() {
  // FIX: filter hanya by petugas yang login
  const myItems = pendingList
    .filter(p => p.petugas === currentUser?.nama)
    .slice(0, 50);

  el("riwayat-petugas-tbody").innerHTML = myItems.length
    ? myItems.map(p => `
        <tr>
          <td>${p.tanggal}</td>
          <td class="mono">${shortNOP(p.nop)}</td>
          <td><strong>${p.nama}</strong></td>
          <td><strong>${p.tahun}</strong></td>
          <td>${p.status === "pending" ? '<span class="badge b-pending">Menunggu</span>' : p.status === "lunas" ? '<span class="badge b-lunas">Approved</span>' : '<span class="badge b-tunggak">Ditolak</span>'}</td>
          <td style="font-size:.78rem;color:var(--c-muted)">${p.ketAdmin || "—"}</td>
        </tr>`)
      .join("")
    : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--c-muted)">Belum ada riwayat upload</td></tr>`;
}

// ─── MODALS ───────────────────────────────────────────────────
export function openModal(id)  { el(id)?.classList.add("open"); }
export function closeModal(id) { el(id)?.classList.remove("open"); }

window.openModal  = openModal;
window.closeModal = closeModal;

// Close on overlay click
document.querySelectorAll(".modal-overlay").forEach(m =>
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); })
);

// ─── EXPOSE GLOBALS ───────────────────────────────────────────
// (needed for inline onclick handlers in HTML)
window.showPage    = showPage;
window.showSection = showSection;
window.doLogin     = doLogin;
window.handleLogout = handleLogout;
window.quickLogin  = quickLogin;
window.toast       = toast;

// ─── GLOBAL DASHBOARD FUNCTIONS ───────────────────────────────
let globalCharts = {};

function destroyGlobalChart(id) { 
  if (globalCharts[id]) { 
    globalCharts[id].destroy(); 
    delete globalCharts[id]; 
  } 
}

export function initGlobalDashboard() {
  const s = getStats(2026);
  
  // Animate KPIs
  animateCount("global-lunas", s.lunas);
  animateCount("global-tunggak", s.tunggak);
  animateCount("global-pending", s.pending);
  animateCount("global-total", wpData.length);
  
  // Render charts
  const tren = getTrenData();
  const { lunas, pending, tunggak } = getStats(2026);
  
  // Tren Chart
  destroyGlobalChart("global-chart-tren");
  globalCharts["global-chart-tren"] = new Chart(el("global-chart-tren").getContext("2d"), {
    type: "line",
    data: {
      labels: TAHUN_LIST.map(String),
      datasets: [{
        label: "% Lunas", 
        data: tren,
        borderColor: "#198c55", 
        backgroundColor: "rgba(25,140,85,.09)",
        fill: true, 
        tension: .4, 
        pointBackgroundColor: "#198c55", 
        pointRadius: 4,
      }],
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { legend: { display: false } },
      scales: { 
        y: { min: 0, max: 100, ticks: { callback: v => v + "%" }, grid: { color: "#dce5de" } }, 
        x: { grid: { display: false } } 
      } 
    },
  });
  
  // Donut Chart
  destroyGlobalChart("global-chart-donut");
  globalCharts["global-chart-donut"] = new Chart(el("global-chart-donut").getContext("2d"), {
    type: "doughnut",
    data: { 
      labels: ["Lunas", "Pending", "Tunggakan"], 
      datasets: [{ 
        data: [lunas, pending, tunggak], 
        backgroundColor: ["#198c55", "#d97706", "#d93025"], 
        borderWidth: 0, 
        hoverOffset: 8 
      }] 
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { 
        legend: { position: "bottom", labels: { padding: 14, font: { size: 12 } } } 
      } 
    },
  });
}

window.globalSearchNOP = function() {
  const nopQuery = el("global-search-nop").value.trim();
  const resultDiv = el("global-search-result");
  
  if (!nopQuery) {
    resultDiv.innerHTML = "";
    return;
  }
  
  const found = wpData.find(w => w.nop === nopQuery || w.nop.includes(nopQuery));
  
  if (!found) {
    resultDiv.innerHTML = `<div class="alert alert-warn"><div class="alert-icon">⚠️</div><div><h4>NOP Tidak Ditemukan</h4><p>NOP yang Anda masukkan tidak terdaftar dalam sistem. Silakan periksa kembali NOP Anda atau hubungi petugas desa.</p></div></div>`;
    return;
  }
  
  const tunggakYears = TAHUN_LIST.filter(y => found.payments[y] === "tunggakan");
  const statusBadge = (s) => {
    if (s === "lunas") return '<span class="badge b-lunas">Lunas</span>';
    if (s === "pending") return '<span class="badge b-pending">Pending</span>';
    return '<span class="badge b-tunggak">Tunggakan</span>';
  };
  
  resultDiv.innerHTML = `
    <div style="border:1px solid var(--c-border); border-radius:var(--r-md); padding:16px; background:var(--c-surface)">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--c-border)">
        <div style="width:48px; height:48px; background:var(--c-brand); border-radius:var(--r-md); display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.5rem; font-weight:700">${found.nama.charAt(0)}</div>
        <div>
          <h4 style="font-size:1rem; margin:0; color:var(--c-text)">${found.nama}</h4>
          <p style="font-size:.75rem; color:var(--c-muted); margin:2px 0 0">${found.dusun} - RW ${found.rw} / RT ${found.rt}</p>
        </div>
      </div>
      
      <div style="margin-bottom:16px">
        <label style="font-size:.7rem; font-weight:700; color:var(--c-muted); text-transform:uppercase; letter-spacing:.05em">NOP</label>
        <div class="mono" style="font-size:.85rem; word-break:break-all">${found.nop}</div>
      </div>
      
      <div style="margin-bottom:16px">
        <label style="font-size:.7rem; font-weight:700; color:var(--c-muted); text-transform:uppercase; letter-spacing:.05em">Status Pembayaran per Tahun</label>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap:8px; margin-top:8px">
          ${[...TAHUN_LIST].reverse().map(y => `
            <div style="text-align:center; padding:8px; border-radius:var(--r-sm); background:${found.payments[y] === 'lunas' ? 'var(--c-brand-pale)' : found.payments[y] === 'pending' ? 'var(--c-warn-pale)' : 'var(--c-danger-pale)'}">
              <div style="font-size:.7rem; color:var(--c-muted)">${y}</div>
              <div style="font-size:.75rem; font-weight:600">${statusBadge(found.payments[y])}</div>
            </div>
          `).join("")}
        </div>
      </div>
      
      ${tunggakYears.length ? `
        <div class="alert alert-warn" style="margin:0">
          <div class="alert-icon">⚠️</div>
          <div>
            <h4 style="font-size:.85rem">Memiliki Tunggakan</h4>
            <p style="font-size:.78rem; margin:4px 0 0">Anda memiliki tunggakan untuk tahun: <strong>${tunggakYears.join(", ")}</strong>. Silakan segera melakukan pembayaran melalui petugas RT, kolektor, atau bank yang ditunjuk.</p>
          </div>
        </div>
      ` : `
        <div class="alert" style="margin:0; background:var(--c-brand-pale); border-color:var(--c-brand-light)">
          <div class="alert-icon" style="color:var(--c-brand)">✅</div>
          <div>
            <h4 style="font-size:.85rem; color:var(--c-brand-dark)">Bebas Tunggakan</h4>
            <p style="font-size:.78rem; margin:4px 0 0; color:var(--c-text-sec)">Alhamdulillah, semua kewajiban PBB Anda telah lunas. Terima kasih atas kontribusi Anda untuk pembangunan desa.</p>
          </div>
        </div>
      `}
    </div>
  `;
};

// ─── BOOT ─────────────────────────────────────────────────────
window.addEventListener("load", () => {
  setTimeout(() => {
    const ls = el("loading-screen");
    ls.style.opacity = "0";
    setTimeout(() => { ls.style.display = "none"; initPublic(); }, 600);
  }, 1800);

  // Mobile hamburger
  const ham = el("hamburger");
  const sb  = el("sidebar");
  if (ham && sb) ham.addEventListener("click", () => sb.classList.toggle("open"));

  // Enter on login password
  el("login-pass")?.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
});
