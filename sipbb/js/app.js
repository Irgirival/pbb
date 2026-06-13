// ============================================================
//  SIPBB – Frontend / App Layer
// ============================================================
"use strict";

import {
  TAHUN_LIST, wpData, pendingList, riwayatList, petugasList,
  currentUser, login, logout as doLogout,
  loadWpData, importBelumBayarExcel, importSppt2026Excel,
  processApproval, submitPayment, addWP, addPetugas,
  getStats, getTrenData, getRWStats, getRTStats,
  searchWP, getTunggakanList, getPendingApprovals,
  getTagihanTotal, getRWList,
} from "./data.js";

// ─── CHART REGISTRY ──────────────────────────────────────────
const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// ─── HELPERS ─────────────────────────────────────────────────
const el = id => document.getElementById(id);

function fmtRp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

function statusBadge(s) {
  if (s === "lunas")   return `<span class="badge b-lunas">Lunas</span>`;
  if (s === "pending") return `<span class="badge b-pending">Pending</span>`;
  return `<span class="badge b-tunggak">Tunggakan</span>`;
}

function shortNOP(nop) { return nop.length > 18 ? nop.substring(0, 18) + "…" : nop; }

export function toast(msg, type = "") {
  const wrap = el("toast-wrap");
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  t.textContent = (type === "err" ? "❌" : type === "warn" ? "⚠️" : "✅") + " " + msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s,transform .3s";
    t.style.opacity = "0"; t.style.transform = "translateX(20px)";
    setTimeout(() => t.remove(), 320);
  }, 4000);
}

function animateCount(elId, target) {
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
export function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = el("page-" + pageId);
  if (target) target.classList.add("active");

  el("btn-nav-login").style.display  = currentUser ? "none" : "";
  el("btn-nav-logout").style.display = currentUser ? ""     : "none";

  if (pageId === "app" && currentUser) refreshAppData();
}

const NAV_MAP = {
  "dashboard":          "nav-dashboard",
  "data-wp":            "nav-data-wp",
  "approval":           "nav-approval",
  "rekap":              "nav-rekap",
  "riwayat":            "nav-riwayat",
  "petugas":            "nav-petugas",
  "import-data":        "nav-import",
  "dashboard-petugas":  "nav-dp",
  "bayar-wp":           "nav-bayar",
  "riwayat-petugas":    "nav-rp",
};

export function showSection(id) {
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
  const sec = el("section-" + id);
  if (sec) sec.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navId = NAV_MAP[id];
  if (navId && el(navId)) el(navId).classList.add("active");

  const renders = {
    "rekap":             buildRekapTable,
    "approval":          buildApprovalTable,
    "riwayat":           buildRiwayatTable,
    "petugas":           buildPetugasTable,
    "data-wp":           buildWPTable,
    "import-data":       buildImportSection,
    "dashboard-petugas": buildPetugasDashboard,
    "riwayat-petugas":   buildRiwayatPetugas,
  };
  if (renders[id]) renders[id]();
}

function refreshAppData() {
  setupSidebar();
  populateRWFilter();
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
  badge.className   = "role-pill " + (u.role==="admin" ? "pill-admin" : u.role==="rt" ? "pill-rt" : "pill-kolektor");
  el("menu-admin").style.display   = u.role === "admin" ? "" : "none";
  el("menu-petugas").style.display = u.role !== "admin" ? "" : "none";
  refreshApprovalBadge();
}

function refreshApprovalBadge() {
  const count = getPendingApprovals().length;
  const b = el("badge-approval");
  if (b) { b.textContent = count; b.style.display = count > 0 ? "" : "none"; }
}

function populateRWFilter() {
  const sel = el("filter-rw");
  if (!sel) return;
  const current = sel.value;
  const rwList = getRWList();
  sel.innerHTML = `<option value="">Semua RW</option>` +
    rwList.map(rw => `<option value="${rw}" ${rw===current?"selected":""}>${rw === "LUAR" ? "Luar Wilayah" : "RW " + rw}</option>`).join("");
}

// ─── PUBLIC INIT ─────────────────────────────────────────────
function initPublic() {
  buildYearTabs();
  buildPublicTable();
  buildPublicCharts();
  const s = getStats(2026);
  animateCount("pub-total-wp",  wpData.length);
  animateCount("pub-lunas",     s.lunas);
  animateCount("pub-tunggakan", s.tunggak);
  animateCount("pub-pending",   s.pending);
  el("pub-persen").textContent = s.persen + "%";
  buildRWCards();
}

function buildYearTabs() {
  el("pub-year-tabs").innerHTML = [...TAHUN_LIST].reverse().map((y, i) =>
    `<button class="ytab${i===0?" active":""}" onclick="selectYearTab(${y},this)">${y}</button>`
  ).join("");
}

window.selectYearTab = (year, btn) => {
  document.querySelectorAll(".ytab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
};

function buildRWCards() {
  const rw = getRWStats(2026);
  const g = el("rw-cards");
  if (!g) return;
  const sorted = Object.entries(rw)
    .filter(([k]) => k !== "LUAR" && k !== "LUAR/MAKAM")
    .sort((a,b) => a[0].localeCompare(b[0]));

  g.innerHTML = sorted.map(([rwKey, d]) => {
    const pct = d.total > 0 ? Math.round(d.lunas / d.total * 100) : 0;
    return `
      <div class="dusun-card">
        <h4>🏘️ RW ${rwKey}</h4>
        <div class="dstat"><label>Total WP</label><strong>${d.total}</strong></div>
        <div class="dstat"><label>Lunas</label><strong style="color:var(--c-brand)">${d.lunas}</strong></div>
        <div class="dstat"><label>Pending</label><strong style="color:var(--c-warn)">${d.pending}</strong></div>
        <div class="dstat"><label>Tunggakan</label><strong style="color:var(--c-danger)">${d.tunggak}</strong></div>
        <div class="dstat"><label>Progress</label><strong>${pct}%</strong></div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>`;
  }).join("");
}

function buildPublicTable(query="", filterStatus="", filterRW="") {
  const data = searchWP(query, filterRW, filterStatus, 60);
  const tbody = el("pub-table-body");
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--c-muted)">Data tidak ditemukan</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(w => {
    const tunggakYears = TAHUN_LIST.filter(y => w.payments[String(y)] === "tunggakan");
    const totalTagihan = getTagihanTotal(w);
    return `<tr>
      <td class="mono" style="font-size:.73rem">${w.nop}</td>
      <td><strong>${w.nama}</strong></td>
      <td><span style="font-size:.78rem">${w.rw === "LUAR" ? "Luar Wil." : "RW " + w.rw} / RT ${w.rt}</span></td>
      <td>${statusBadge(w.payments["2024"])}</td>
      <td>${statusBadge(w.payments["2025"])}</td>
      <td>${statusBadge(w.payments["2026"])}</td>
      <td>${tunggakYears.length ? `<span style="color:var(--c-danger);font-size:.75rem">${tunggakYears.join(", ")}</span>` : `<span style="color:var(--c-brand);font-size:.75rem">✓ Bersih</span>`}</td>
      <td class="mono" style="font-size:.75rem">${totalTagihan > 0 ? fmtRp(totalTagihan) : "—"}</td>
    </tr>`;
  }).join("");
}

window.pubSearch = () => {
  buildPublicTable(
    el("pub-search").value,
    el("pub-filter-status").value,
    el("pub-filter-rw")?.value || ""
  );
};

// ─── CHARTS ──────────────────────────────────────────────────
function buildPublicCharts() {
  const tren   = getTrenData();
  const rwStat = getRWStats(2026);
  const rtStat = getRTStats(2026);
  const { lunas, pending, tunggak } = getStats(2026);

  destroyChart("chart-tren");
  charts["chart-tren"] = new Chart(el("chart-tren").getContext("2d"), {
    type: "line",
    data: { labels: TAHUN_LIST.map(String), datasets: [{ label:"% Lunas", data:tren, borderColor:"#198c55", backgroundColor:"rgba(25,140,85,.09)", fill:true, tension:.4, pointBackgroundColor:"#198c55", pointRadius:4 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ min:0,max:100,ticks:{ callback:v=>v+"%" },grid:{ color:"#dce5de" } },x:{ grid:{ display:false } } } },
  });

  destroyChart("chart-donut");
  charts["chart-donut"] = new Chart(el("chart-donut").getContext("2d"), {
    type: "doughnut",
    data: { labels:["Lunas","Pending","Tunggakan"], datasets:[{ data:[lunas,pending,tunggak], backgroundColor:["#198c55","#d97706","#d93025"], borderWidth:0, hoverOffset:8 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"bottom", labels:{ padding:14,font:{ size:12 } } } } },
  });

  // Per RW — skip LUAR, ambil top 10
  const rwKeys = Object.keys(rwStat).filter(k=>k!=="LUAR"&&k!=="LUAR/MAKAM").sort().slice(0,10);
  destroyChart("chart-rw");
  charts["chart-rw"] = new Chart(el("chart-rw").getContext("2d"), {
    type: "bar",
    data: { labels: rwKeys.map(r=>"RW "+r), datasets:[
      { label:"Lunas",     data:rwKeys.map(r=>rwStat[r].lunas),   backgroundColor:"#198c55",borderRadius:3 },
      { label:"Tunggakan", data:rwKeys.map(r=>rwStat[r].tunggak), backgroundColor:"#d93025",borderRadius:3 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"bottom" } }, scales:{ x:{ stacked:true,grid:{ display:false } },y:{ stacked:true,grid:{ color:"#dce5de" } } } },
  });

  // Per RT
  const rtKeys = Object.keys(rtStat).filter(k=>k!=="LUAR"&&k!=="L").sort().slice(0,10);
  destroyChart("chart-rt");
  charts["chart-rt"] = new Chart(el("chart-rt").getContext("2d"), {
    type: "bar",
    data: { labels: rtKeys.map(r=>"RT "+r), datasets:[{ label:"% Lunas", data:rtKeys.map(r=>rtStat[r].total>0?Math.round(rtStat[r].lunas/rtStat[r].total*100):0), backgroundColor:"rgba(14,107,63,.8)",borderRadius:4 }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ min:0,max:100,ticks:{ callback:v=>v+"%" },grid:{ color:"#dce5de" } },x:{ grid:{ display:false } } } },
  });
}

// ─── ADMIN: DASHBOARD ────────────────────────────────────────
function buildAdminDashboard() {
  const s = getStats(2026);
  el("kpi-lunas").textContent    = s.lunas.toLocaleString("id-ID");
  el("kpi-tunggak").textContent  = s.tunggak.toLocaleString("id-ID");
  el("kpi-pending").textContent  = s.pending;
  el("kpi-total-wp").textContent = s.total.toLocaleString("id-ID");

  const tren     = getTrenData();
  const rwStat   = getRWStats(2026);

  destroyChart("admin-chart-tren");
  charts["admin-chart-tren"] = new Chart(el("admin-chart-tren").getContext("2d"), {
    type:"line",
    data:{ labels:TAHUN_LIST.map(String), datasets:[{ label:"% Lunas",data:tren,borderColor:"#198c55",backgroundColor:"rgba(25,140,85,.09)",fill:true,tension:.4,pointBackgroundColor:"#198c55",pointRadius:4 }] },
    options:{ responsive:true,maintainAspectRatio:false,plugins:{ legend:{ display:false } },scales:{ y:{ min:0,max:100,ticks:{ callback:v=>v+"%" },grid:{ color:"#dce5de" } },x:{ grid:{ display:false } } } },
  });

  const rwKeys = Object.keys(rwStat).filter(k=>k!=="LUAR"&&k!=="LUAR/MAKAM").sort().slice(0,8);
  destroyChart("admin-chart-rw");
  charts["admin-chart-rw"] = new Chart(el("admin-chart-rw").getContext("2d"), {
    type:"bar",
    data:{ labels:rwKeys.map(r=>"RW "+r), datasets:[
      { label:"Lunas",     data:rwKeys.map(r=>rwStat[r].lunas),   backgroundColor:"#198c55",borderRadius:4 },
      { label:"Tunggakan", data:rwKeys.map(r=>rwStat[r].tunggak), backgroundColor:"#d93025",borderRadius:4 },
    ]},
    options:{ responsive:true,maintainAspectRatio:false,plugins:{ legend:{ position:"bottom" } },scales:{ x:{ grid:{ display:false } },y:{ grid:{ color:"#dce5de" } } } },
  });

  buildPendingPreview();
}

function buildPendingPreview() {
  const pending = getPendingApprovals().slice(0,5);
  const wrap = el("admin-pending-preview");
  if (!pending.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Tidak ada pembayaran yang menunggu persetujuan</p></div>`;
    return;
  }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Tanggal</th><th>NOP</th><th>Nama WP</th><th>Tahun</th><th>Petugas</th><th>Aksi</th></tr></thead>
    <tbody>${pending.map(p=>`<tr>
      <td>${p.tanggal}</td>
      <td class="mono" style="font-size:.73rem">${shortNOP(p.nop)}</td>
      <td><strong>${p.nama}</strong></td>
      <td><strong>${p.tahun}</strong></td>
      <td>${p.petugas}</td>
      <td>
        <button class="btn btn-success btn-sm" onclick="approveItem(${p.id},true)">✓ Approve</button>
        <button class="btn btn-danger btn-sm"  onclick="approveItem(${p.id},false)" style="margin-left:4px">✕</button>
      </td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

// ─── ADMIN: DATA WP ──────────────────────────────────────────
function buildWPTable() {
  const q      = el("admin-search-wp")?.value || "";
  const rw     = el("filter-rw")?.value || "";
  const status = el("filter-status-wp")?.value || "";
  const data   = searchWP(q, rw, status, 100);

  el("admin-wp-tbody").innerHTML = data.map(w => {
    const tunggakYears = TAHUN_LIST.filter(y => w.payments[String(y)] === "tunggakan");
    const totalTagihan = getTagihanTotal(w);
    return `<tr>
      <td class="mono" style="font-size:.73rem">${w.nop}</td>
      <td><strong>${w.nama}</strong></td>
      <td>${w.rw === "LUAR" ? "Luar Wil." : "RW "+w.rw}</td>
      <td>RT ${w.rt}</td>
      <td>${statusBadge(w.payments["2026"])}</td>
      <td>${tunggakYears.length ? `<span style="color:var(--c-danger);font-size:.8rem">${tunggakYears.length} tahun</span>` : `<span style="color:var(--c-brand);font-size:.8rem">Bersih</span>`}</td>
      <td class="mono" style="font-size:.75rem">${totalTagihan>0?fmtRp(totalTagihan):"—"}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showDetailWP(${w.id})">Detail</button></td>
    </tr>`;
  }).join("");
}

window.filterWP = buildWPTable;

window.showDetailWP = id => {
  const w = wpData.find(x => x.id === id);
  if (!w) return;
  const tunggak = TAHUN_LIST.filter(y => w.payments[String(y)] === "tunggakan");
  el("modal-wp-content").innerHTML = `
    ${tunggak.length ? `<div class="alert alert-danger"><div class="alert-icon">⚠️</div><div><h4>Memiliki Tunggakan</h4><p>Belum lunas: ${tunggak.join(", ")}</p></div></div>` : ""}
    <div class="info-row"><label>NOP</label><strong class="mono" style="font-size:.8rem">${w.nop}</strong></div>
    <div class="info-row"><label>Nama WP</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>RW / RT</label><strong>${w.rw === "LUAR" ? "Luar Wilayah" : "RW "+w.rw} / RT ${w.rt}</strong></div>
    <h4 style="margin:20px 0 10px;font-size:.88rem;color:var(--c-muted);text-transform:uppercase;letter-spacing:.04em">Riwayat Pembayaran</h4>
    <div class="table-wrap"><table>
      <thead><tr><th>Tahun</th><th>Status</th><th>Tagihan</th></tr></thead>
      <tbody>${[...TAHUN_LIST].reverse().map(y=>`
        <tr>
          <td><strong>${y}</strong></td>
          <td>${statusBadge(w.payments[String(y)])}</td>
          <td class="mono" style="font-size:.78rem">${w.tagihan?.[String(y)] ? fmtRp(w.tagihan[String(y)]) : "—"}</td>
        </tr>`).join("")}</tbody>
    </table></div>`;
  openModal("modal-detail-wp");
};

// ─── ADMIN: APPROVAL ─────────────────────────────────────────
function buildApprovalTable() {
  el("approval-tbody").innerHTML = pendingList.map(p=>`<tr>
    <td>${p.tanggal}</td>
    <td class="mono" style="font-size:.73rem">${shortNOP(p.nop)}</td>
    <td><strong>${p.nama}</strong></td>
    <td><strong>${p.tahun}</strong></td>
    <td>${p.petugas}</td>
    <td><button class="btn btn-outline btn-sm" onclick="viewBukti(${p.id})">📎 Lihat</button></td>
    <td>${p.status==="pending"?'<span class="badge b-pending">Pending</span>':p.status==="lunas"?'<span class="badge b-lunas">Approved</span>':'<span class="badge b-tunggak">Rejected</span>'}</td>
    <td>${p.status==="pending"
      ?`<button class="btn btn-success btn-sm" onclick="approveItem(${p.id},true)">✓</button> <button class="btn btn-danger btn-sm" onclick="approveItem(${p.id},false)">✕</button>`
      :`<span style="font-size:.78rem;color:var(--c-muted)">${p.ketAdmin}</span>`
    }</td>
  </tr>`).join("");
}

window.approveItem = (id, approved) => {
  const r = processApproval(id, approved, currentUser.nama);
  if (!r) return;
  toast(approved ? "Pembayaran disetujui!" : "Pembayaran ditolak", approved ? "" : "err");
  buildApprovalTable(); buildPendingPreview(); refreshApprovalBadge();
  const s = getStats(2026);
  if (el("kpi-lunas"))   el("kpi-lunas").textContent   = s.lunas.toLocaleString("id-ID");
  if (el("kpi-tunggak")) el("kpi-tunggak").textContent = s.tunggak.toLocaleString("id-ID");
  if (el("kpi-pending")) el("kpi-pending").textContent = s.pending;
  buildPublicTable(); buildRWCards();
};

window.viewBukti = id => {
  const p = pendingList.find(x=>x.id===id);
  el("modal-bukti-content").innerHTML = `
    <div class="info-row"><label>NOP</label><strong class="mono" style="font-size:.8rem">${p.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${p.nama}</strong></div>
    <div class="info-row"><label>Tahun</label><strong>${p.tahun}</strong></div>
    <div class="info-row"><label>Petugas</label><strong>${p.petugas}</strong></div>
    ${p.buktiUrl?`<img src="${p.buktiUrl}" style="width:100%;border-radius:var(--r-md);margin-top:16px">`:`<div style="margin-top:16px;text-align:center;background:var(--c-bg);border-radius:var(--r-md);padding:40px"><div style="font-size:3rem">📎</div><p style="color:var(--c-muted);margin-top:8px;font-size:.875rem">Pratinjau tidak tersedia</p></div>`}
    ${p.status==="pending"?`<div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-success" style="flex:1" onclick="approveItem(${p.id},true);closeModal('modal-bukti')">✓ Approve</button>
      <button class="btn btn-danger"  style="flex:1" onclick="approveItem(${p.id},false);closeModal('modal-bukti')">✕ Reject</button>
    </div>`:""}`;
  openModal("modal-bukti");
};

// ─── ADMIN: REKAP ─────────────────────────────────────────────
function buildRekapTable() {
  const data = getTunggakanList();
  el("rek-total").textContent = data.length.toLocaleString("id-ID");
  el("rek-1th").textContent   = data.filter(w=>TAHUN_LIST.filter(y=>w.payments[String(y)]==="tunggakan").length===1).length;
  el("rek-multi").textContent = data.filter(w=>TAHUN_LIST.filter(y=>w.payments[String(y)]==="tunggakan").length>1).length;

  el("rekap-tbody").innerHTML = data.slice(0,200).map(w=>{
    const t     = TAHUN_LIST.filter(y=>w.payments[String(y)]==="tunggakan");
    const total = getTagihanTotal(w);
    return `<tr>
      <td class="mono" style="font-size:.73rem">${w.nop}</td>
      <td><strong>${w.nama}</strong></td>
      <td><span style="font-size:.78rem">${w.rw==="LUAR"?"Luar Wil.":"RW "+w.rw} / RT ${w.rt}</span></td>
      <td><span style="color:var(--c-danger);font-weight:600;font-size:.83rem">${t.join(", ")}</span></td>
      <td><span class="badge b-tunggak">${t.length} thn</span></td>
      <td class="mono" style="font-size:.75rem">${total>0?fmtRp(total):"—"}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showDetailWP(${w.id})">Detail</button></td>
    </tr>`;
  }).join("");
}

// ─── ADMIN: RIWAYAT ──────────────────────────────────────────
function buildRiwayatTable() {
  el("riwayat-tbody").innerHTML = riwayatList.length
    ? riwayatList.map(r=>`<tr>
        <td>${r.tglLunas}</td>
        <td class="mono" style="font-size:.73rem">${shortNOP(r.nop)}</td>
        <td><strong>${r.nama}</strong></td>
        <td><strong>${r.tahun}</strong></td>
        <td>${r.petugas}</td>
        <td><span class="badge b-lunas">${r.approvedBy}</span></td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--c-muted)">Belum ada riwayat</td></tr>`;
}

// ─── ADMIN: PETUGAS ──────────────────────────────────────────
function buildPetugasTable() {
  el("petugas-tbody").innerHTML = petugasList.map(p=>`<tr>
    <td><strong>${p.nama}</strong></td>
    <td class="mono">${p.username}</td>
    <td><span class="badge ${p.role==="rt"?"b-approved":"b-lunas"}">${p.role.toUpperCase()}</span></td>
    <td style="font-size:.78rem">${p.wilayah}</td>
    <td>${p.totalUpload}</td>
    <td>
      <button class="btn btn-outline btn-sm" onclick="toast('Edit: ${p.nama}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="toast('Hapus: ${p.nama}','err')" style="margin-left:4px">Hapus</button>
    </td>
  </tr>`).join("");
}

// ─── ADMIN: IMPORT DATA ───────────────────────────────────────
function buildImportSection() {
  // Sudah di-render di HTML, hanya update status
  const s = getStats(2026);
  const statusDiv = el("import-db-status");
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div class="alert" style="background:var(--c-brand-pale);border:1px solid rgba(14,107,63,.2);color:var(--c-brand-dark)">
        <div class="alert-icon">📊</div>
        <div>
          <h4>Database Aktif</h4>
          <p>${s.total} wajib pajak terdaftar · ${s.tunggak} tunggakan · ${s.lunas} lunas</p>
        </div>
      </div>`;
  }
}

// Handler upload Belum Bayar Excel
window.handleImportBelumBayar = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const btn = el("btn-import-bb");
  btn.disabled = true;
  btn.textContent = "⏳ Memproses…";
  try {
    const count = await importBelumBayarExcel(file);
    toast(`✅ Berhasil import ${count} wajib pajak dari Excel!`);
    buildAdminDashboard();
    buildPublicTable();
    buildPublicCharts();
    buildRWCards();
    buildImportSection();
    populateRWFilter();
  } catch (e) {
    toast("Gagal import: " + e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "📂 Pilih File Excel";
  }
};

// Handler upload SPPT 2026
window.handleImportSppt = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const btn = el("btn-import-sppt");
  btn.disabled = true;
  btn.textContent = "⏳ Memproses…";
  try {
    const count = await importSppt2026Excel(file);
    toast(`✅ Berhasil import ${count} data SPPT 2026!`);
    buildAdminDashboard();
    buildPublicTable();
    buildPublicCharts();
    buildImportSection();
  } catch (e) {
    if (e.message === "ENCRYPTED") {
      toast("File SPPT terenkripsi/berpassword. Harap hapus password di Excel dulu.", "warn");
      el("sppt-enc-warn").style.display = "";
    } else {
      toast("Gagal import SPPT: " + e.message, "err");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "📂 Pilih File SPPT";
  }
};

// ─── TAMBAH WP / PETUGAS ─────────────────────────────────────
window.openModalTambahWP = () => openModal("modal-tambah-wp");
window.openModalTambahPetugas = () => openModal("modal-tambah-petugas");

window.simpanWP = () => {
  const nop  = el("twp-nop").value.trim();
  const nama = el("twp-nama").value.trim();
  const rw   = el("twp-rw").value.trim();
  const rt   = el("twp-rt").value.trim();
  if (!nop || !nama) { toast("Lengkapi NOP dan Nama WP!", "err"); return; }
  addWP({ nop, nama, rt, rw });
  toast(`WP berhasil ditambahkan: ${nama}`);
  closeModal("modal-tambah-wp");
  buildWPTable();
};

window.simpanPetugas = () => {
  const nama     = el("tp-nama").value.trim();
  const username = el("tp-user").value.trim();
  const password = el("tp-pass").value;
  const role     = el("tp-role").value;
  const wilayah  = el("tp-wilayah").value.trim();
  if (!nama || !username || !password) { toast("Lengkapi data petugas!", "err"); return; }
  addPetugas({ nama, username, password, role, wilayah });
  toast(`Petugas berhasil ditambahkan: ${nama}`);
  closeModal("modal-tambah-petugas");
  buildPetugasTable();
};

// ─── PETUGAS: DASHBOARD ──────────────────────────────────────
function buildPetugasDashboard() {
  if (!currentUser) return;
  el("petugas-greeting").textContent = `Halo, ${currentUser.nama} — ${currentUser.wilayah || "Semua Wilayah"}`;
  const myWP = wpData.slice(0, 100);
  let lunas=0, belum=0, pending=0;
  myWP.forEach(w => {
    const s = w.payments["2026"];
    if (s==="lunas") lunas++;
    else if (s==="pending") pending++;
    else belum++;
  });
  el("pet-lunas").textContent   = lunas;
  el("pet-belum").textContent   = belum;
  el("pet-pending").textContent = pending;
  el("pet-total").textContent   = myWP.length;
  el("petugas-wp-tbody").innerHTML = myWP
    .filter(w=>w.payments["2026"]!=="lunas")
    .slice(0,25)
    .map(w=>`<tr>
      <td class="mono" style="font-size:.73rem">${shortNOP(w.nop)}</td>
      <td><strong>${w.nama}</strong></td>
      <td>${statusBadge(w.payments["2026"])}</td>
      <td><button class="btn btn-primary btn-sm" onclick="prefillBayar(${w.id})">Input Bayar</button></td>
    </tr>`).join("");
}

// ─── PETUGAS: INPUT BAYAR ────────────────────────────────────
let _selWP = null, _selFile = null;

window.prefillBayar = id => {
  _selWP = wpData.find(w=>w.id===id);
  showSection("bayar-wp");
  if (_selWP) { el("bayar-search").value = _selWP.nama; showBayarInfo(_selWP); }
};

window.searchBayarWP = () => {
  const q = el("bayar-search").value.toLowerCase();
  const div = el("bayar-wp-result");
  if (!q) { div.innerHTML=""; return; }
  const res = wpData.filter(w=>w.nama.toLowerCase().includes(q)||w.nop.includes(q)).slice(0,6);
  if (!res.length) { div.innerHTML=`<p style="font-size:.8rem;color:var(--c-muted);padding:8px">Tidak ditemukan</p>`; return; }
  div.innerHTML = `<div style="border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;box-shadow:var(--shadow-sm)">
    ${res.map(w=>`<div class="bri" style="padding:10px 14px;cursor:pointer;font-size:.84rem;border-bottom:1px solid var(--c-border)" onclick="selectBayarWP(${w.id})">
      <strong>${w.nama}</strong><span style="color:var(--c-muted);font-size:.78rem"> — RW ${w.rw} RT ${w.rt}</span>
      <div style="margin-top:4px">${statusBadge(w.payments["2026"])}</div>
    </div>`).join("")}
  </div>`;
  div.querySelectorAll(".bri").forEach(item => {
    item.addEventListener("mouseenter", ()=>item.style.background="var(--c-bg)");
    item.addEventListener("mouseleave", ()=>item.style.background="");
  });
};

window.selectBayarWP = id => {
  _selWP = wpData.find(w=>w.id===id);
  el("bayar-search").value = _selWP.nama;
  el("bayar-wp-result").innerHTML = "";
  showBayarInfo(_selWP);
};

function showBayarInfo(w) {
  const tunggak = TAHUN_LIST.filter(y=>w.payments[String(y)]==="tunggakan");
  el("bayar-info-detail").innerHTML = `
    ${tunggak.length?`<div class="alert alert-warn"><div class="alert-icon">⚠️</div><div><h4>Ada Tunggakan</h4><p>Tahun: ${tunggak.join(", ")}</p></div></div>`:""}
    <div class="info-row"><label>NOP</label><strong class="mono" style="font-size:.78rem">${w.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>RW / RT</label><strong>${w.rw==="LUAR"?"Luar Wilayah":"RW "+w.rw} / RT ${w.rt}</strong></div>
    <div class="info-row"><label>Status 2026</label><strong>${statusBadge(w.payments["2026"])}</strong></div>
    <div style="margin-top:16px">
      ${[...TAHUN_LIST].reverse().map(y=>`<div class="info-row"><label>${y}</label><div style="display:flex;gap:8px;align-items:center">${statusBadge(w.payments[String(y)])}${w.tagihan?.[String(y)]?`<span class="mono" style="font-size:.75rem;color:var(--c-muted)">${fmtRp(w.tagihan[String(y)])}</span>`:""}</div></div>`).join("")}
    </div>`;
}

window.previewBukti = input => {
  _selFile = input.files[0];
  if (_selFile) {
    const reader = new FileReader();
    reader.onload = e => { const img=el("bukti-preview"); img.src=e.target.result; img.style.display="block"; };
    reader.readAsDataURL(_selFile);
  }
};

window.submitBayar = () => {
  if (!_selWP) { toast("Pilih wajib pajak terlebih dahulu!", "err"); return; }
  const tahun  = parseInt(el("bayar-tahun").value);
  const status = _selWP.payments[String(tahun)];
  if (status==="lunas")   { toast("WP ini sudah lunas untuk tahun "+tahun, "warn"); return; }
  if (status==="pending") { toast("Sudah ada pengajuan pending untuk tahun "+tahun, "warn"); return; }
  submitPayment({ wpId:_selWP.id, tahun, petugasNama:currentUser.nama, file:_selFile });
  toast("Bukti bayar diupload! Menunggu approval admin.");
  _selWP=null; _selFile=null;
  el("bayar-search").value="";
  el("bayar-wp-result").innerHTML="";
  el("bayar-info-detail").innerHTML=`<div class="empty"><div class="empty-icon">✅</div><p>Upload berhasil! Menunggu approval Admin Desa.</p></div>`;
  el("bukti-preview").style.display="none";
};

// ─── PETUGAS: RIWAYAT ────────────────────────────────────────
function buildRiwayatPetugas() {
  const items = pendingList.filter(p=>p.petugas===currentUser?.nama).slice(0,50);
  el("riwayat-petugas-tbody").innerHTML = items.length
    ? items.map(p=>`<tr>
        <td>${p.tanggal}</td>
        <td class="mono" style="font-size:.73rem">${shortNOP(p.nop)}</td>
        <td><strong>${p.nama}</strong></td>
        <td><strong>${p.tahun}</strong></td>
        <td>${p.status==="pending"?'<span class="badge b-pending">Menunggu</span>':p.status==="lunas"?'<span class="badge b-lunas">Approved</span>':'<span class="badge b-tunggak">Ditolak</span>'}</td>
        <td style="font-size:.78rem;color:var(--c-muted)">${p.ketAdmin||"—"}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--c-muted)">Belum ada riwayat upload</td></tr>`;
}

// ─── MODALS ───────────────────────────────────────────────────
export function openModal(id)  { el(id)?.classList.add("open"); }
export function closeModal(id) { el(id)?.classList.remove("open"); }
window.openModal  = openModal;
window.closeModal = closeModal;
document.querySelectorAll(".modal-overlay").forEach(m =>
  m.addEventListener("click", e=>{ if(e.target===m) m.classList.remove("open"); })
);

// ─── GLOBALS ─────────────────────────────────────────────────
window.showPage       = showPage;
window.showSection    = showSection;
window.doLogin        = doLogin;
window.handleLogout   = handleLogout;
window.quickLogin     = quickLogin;
window.toast          = toast;

// ─── BOOT ────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  // Load real data dulu
  await loadWpData();

  setTimeout(() => {
    const ls = el("loading-screen");
    ls.style.opacity = "0";
    setTimeout(() => { ls.style.display="none"; initPublic(); }, 600);
  }, 1800);

  el("hamburger")?.addEventListener("click", () => el("sidebar")?.classList.toggle("open"));
  el("login-pass")?.addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });
});
