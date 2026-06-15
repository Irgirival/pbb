"use strict";
import {
  TAHUN_LIST, DUSUN_DATA, wpData, pendingList, riwayatList, petugasList,
  currentUser, login, logout as doLogout, processApproval, submitPayment, addWP,
  getStats, getTrenData, getDusunStats, searchWP, getPendingApprovals,
  getWPByRole, exportToCSV
} from "./data.js";

const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function el(id) { return document.getElementById(id); }

function statusBadge(s) {
  if (s === "lunas") return `<span class="badge b-lunas">Lunas</span>`;
  if (s === "pending") return `<span class="badge b-pending">Pending</span>`;
  return `<span class="badge b-tunggak">Tunggakan</span>`;
}
function shortNOP(nop) { return nop.substring(0, 14) + "…"; }

export function toast(msg, type = "") {
  const wrap = el("toast-wrap");
  const t = document.createElement("div");
  t.className = "toast " + (type ? " " + type : "");
  const icon = type === "err" ? "❌" : type === "warn" ? "⚠️" : "✅";
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0"; t.style.transform = "translateX(20px)";
    setTimeout(() => t.remove(), 320);
  }, 3500);
}

export function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = el("page-" + pageId);
  if (target) { target.classList.add("active"); }
  const loggedIn = !!currentUser;
  if(el("btn-nav-login")) el("btn-nav-login").style.display = loggedIn ? "none" : "";
  if(el("btn-nav-logout")) el("btn-nav-logout").style.display = loggedIn ? "" : "none";
  if (pageId === "app" && currentUser) refreshAppData();
}

const NAV_MAP = {
  "dashboard": "nav-dashboard", "data-wp": "nav-data-wp", "approval": "nav-approval",
  "rekap": "nav-rekap", "riwayat": "nav-riwayat", "petugas": "nav-petugas",
  "dashboard-petugas": "nav-dp", "bayar-wp": "nav-bayar", "riwayat-petugas": "nav-rp",
};

export function showSection(id) {
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
  const section = el("section-" + id);
  if (section) section.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navId = NAV_MAP[id];
  if (navId && el(navId)) el(navId).classList.add("active");
  
  const renders = {
    "rekap": buildRekapTable, "approval": buildApprovalTable, "riwayat": buildRiwayatTable,
    "petugas": buildPetugasTable, "data-wp": buildWPTable, "dashboard-petugas": buildPetugasDashboard,
    "riwayat-petugas": buildRiwayatPetugas,
  };
  if (renders[id]) renders[id]();
}

function refreshAppData() {
  setupSidebar();
  if (currentUser.role === "admin") { showSection("dashboard"); buildAdminDashboard(); } 
  else { showSection("dashboard-petugas"); buildPetugasDashboard(); }
}

export function doLogin() {
  const role = el("login-role").value, user = el("login-user").value.trim(), pass = el("login-pass").value;
  const found = login(role, user, pass);
  if (!found) { toast("Username atau password salah!", "err"); return; }
  setupSidebar(); showPage("app"); toast(`Selamat datang, ${found.nama}! 👋`);
}
export function handleLogout() { doLogout(); showPage("public"); toast("Berhasil keluar"); }
export function quickLogin(role, user, pass) {
  el("login-role").value = role; el("login-user").value = user; el("login-pass").value = pass;
}

function setupSidebar() {
  const u = currentUser;
  el("sb-avatar").textContent = u.nama[0].toUpperCase();
  el("sb-name").textContent = u.nama;
  el("sb-role").textContent = u.role === "admin" ? "Admin Desa" : u.role === "rt" ? "Petugas RT" : "Kolektor";
  const badge = el("sb-badge");
  badge.textContent = u.role.toUpperCase();
  badge.className = "role-pill " + (u.role === "admin" ? "pill-admin" : u.role === "rt" ? "pill-rt" : "pill-kolektor");
  el("menu-admin").style.display = u.role === "admin" ? "" : "none";
  el("menu-petugas").style.display = u.role !== "admin" ? "" : "none";
}

// ─── PUBLIC VIEW (PRIVACY FIRST: NO DEFAULT TABLE) ───
function initPublic() {
  buildDusunGrid();
  buildPublicCharts();
  const s = getStats(2026);
  el("pub-total-wp").textContent = wpData.length.toLocaleString("id-ID");
  el("pub-lunas").textContent = s.lunas.toLocaleString("id-ID");
  el("pub-tunggakan").textContent = s.tunggak.toLocaleString("id-ID");
  el("pub-persen").textContent = s.persen + "%";
  
  // Default state: Hide table, show prompt
  el("pub-search-result").style.display = "none";
}

window.pubSearch = function() {
  const q = el("pub-search").value.trim();
  if (q.length < 3) { toast("Masukkan minimal 3 karakter NOP atau Nama", "warn"); return; }
  
  const data = searchWP(q, "", "", 10);
  const wrap = el("pub-search-result");
  wrap.style.display = "block";
  
  if (!data.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p>Data tidak ditemukan. Pastikan NOP atau Nama benar.</p></div>`;
    return;
  }
  
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>NOP</th><th>Nama WP</th><th>Lokasi</th><th>Status 2026</th><th>Aksi</th></tr></thead><tbody>
    ${data.map(w => `<tr>
      <td class="mono">${shortNOP(w.nop)}</td>
      <td><strong>${w.nama}</strong></td>
      <td>${w.dusun} RW ${w.rw} / RT ${w.rt}</td>
      <td>${statusBadge(w.payments[2026])}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showPublicDetail(${w.id})">Lihat Detail</button></td>
    </tr>`).join("")}
  </tbody></table></div>`;
};

window.showPublicDetail = function(id) {
  const w = wpData.find(x => x.id === id);
  if (!w) return;
  el("modal-wp-content").innerHTML = `
    <div class="info-row"><label>NOP</label><strong class="mono">${w.nop}</strong></div>
    <div class="info-row"><label>Nama WP</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>Lokasi</label><strong>${w.dusun} / RW ${w.rw} / RT ${w.rt}</strong></div>
    <h4 style="margin:20px 0 12px;font-size:.9rem">Riwayat Pembayaran</h4>
    <div class="table-wrap"><table><thead><tr><th>Tahun</th><th>Status</th></tr></thead><tbody>
      ${[...TAHUN_LIST].reverse().map(y => `<tr><td><strong>${y}</strong></td><td>${statusBadge(w.payments[y])}</td></tr>`).join("")}
    </tbody></table></div>`;
  openModal("modal-detail-wp");
};

function buildDusunGrid() {
  el("dusun-grid").innerHTML = getDusunStats(2026).map(d => `
    <div class="dusun-card">
      <h4>🏘️ ${d.nama}</h4>
      <div class="dstat"><label>Total WP</label><strong>${d.total}</strong></div>
      <div class="dstat"><label>Lunas</label><strong style="color:var(--c-brand)">${d.lunas}</strong></div>
      <div class="dstat"><label>Progress</label><strong>${d.persen}%</strong></div>
      <div class="progress"><div class="progress-bar" style="width:${d.persen}%"></div></div>
    </div>`).join("");
}

function buildPublicCharts() {
  const tren = getTrenData();
  destroyChart("chart-tren");
  charts["chart-tren"] = new Chart(el("chart-tren").getContext("2d"), {
    type: "line",
    data: { labels: TAHUN_LIST.map(String), datasets: [{ label: "% Lunas", data: tren, borderColor: "#198c55", backgroundColor: "rgba(25,140,85,.09)", fill: true, tension: .4, pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" } } } }
  });
}

// ─── ADMIN DASHBOARD ───
function buildAdminDashboard() {
  const s = getStats(2026);
  el("kpi-lunas").textContent = s.lunas;
  el("kpi-tunggak").textContent = s.tunggak;
  el("kpi-pending").textContent = s.pending;
  buildPendingPreview();
}

function buildPendingPreview() {
  const pending = getPendingApprovals().slice(0, 5);
  const wrap = el("admin-pending-preview");
  if (!pending.length) { wrap.innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Tidak ada pembayaran yang menunggu persetujuan</p></div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>NOP</th><th>Nama</th><th>Tahun</th><th>Metode</th><th>Aksi</th></tr></thead><tbody>
    ${pending.map(p => `<tr>
      <td>${p.tanggal}</td><td class="mono">${shortNOP(p.nop)}</td><td><strong>${p.nama}</strong></td>
      <td><strong>${p.tahun}</strong></td><td><span class="bdg bdg-rt">${p.metodeBayar}</span></td>
      <td>
        <button class="btn btn-success btn-sm" onclick="approveItem(${p.id}, true)">✓</button>
        <button class="btn btn-danger btn-sm" onclick="approveItem(${p.id}, false)" style="margin-left:4px">✕</button>
      </td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

window.approveItem = function(id, approved) {
  const result = processApproval(id, approved, currentUser.nama);
  if (!result) return;
  toast(approved ? "✅ Pembayaran disetujui!" : "❌ Pembayaran ditolak", approved ? "" : "err");
  buildApprovalTable(); buildPendingPreview(); buildAdminDashboard();
};

window.viewBukti = function(id) {
  const p = pendingList.find(x => x.id === id);
  el("modal-bukti-content").innerHTML = `
    <div class="info-row"><label>NOP</label><strong>${p.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${p.nama}</strong></div>
    <div class="info-row"><label>Tahun</label><strong>${p.tahun}</strong></div>
    <div class="info-row"><label>Metode Bayar</label><strong>${p.metodeBayar}</strong></div>
    <div class="info-row"><label>Keterangan Petugas</label><strong>${p.keterangan || '-'}</strong></div>
    ${p.buktiUrl ? `<img src="${p.buktiUrl}" style="width:100%;border-radius:var(--r-md);margin-top:16px">` : `<div style="margin-top:16px;text-align:center;background:var(--c-bg);padding:40px;border-radius:var(--r-md)"><p>Pratinjau tidak tersedia (demo)</p></div>`}
    ${p.status === "pending" ? `<div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-success" style="flex:1" onclick="approveItem(${p.id},true);closeModal('modal-bukti')">✓ Approve</button>
      <button class="btn btn-danger" style="flex:1" onclick="approveItem(${p.id},false);closeModal('modal-bukti')">✕ Reject</button>
    </div>` : ""}`;
  openModal("modal-bukti");
};

// ─── ADMIN: REKAP & EXPORT ───
function buildRiwayatTable() {
  // Filter berdasarkan tanggal jika ada
  const startDate = el("export-start")?.value;
  const endDate = el("export-end")?.value;
  
  let filtered = riwayatList;
  if (startDate) filtered = filtered.filter(r => r.tglLunas >= startDate);
  if (endDate) filtered = filtered.filter(r => r.tglLunas <= endDate);

  el("riwayat-tbody").innerHTML = filtered.map(r => `<tr>
    <td>${r.tglLunas}</td><td class="mono">${shortNOP(r.nop)}</td><td><strong>${r.nama}</strong></td>
    <td><strong>${r.tahun}</strong></td><td>${r.petugas}</td><td><span class="bdg bdg-rt">${r.metodeBayar}</span></td>
    <td><span class="badge b-approved">${r.approvedBy}</span></td>
  </tr>`).join("");
  
  // Update count
  el("rek-total-approved").textContent = filtered.length;
}

window.filterRiwayat = buildRiwayatTable;

window.exportRiwayatCSV = function() {
  const startDate = el("export-start")?.value;
  const endDate = el("export-end")?.value;
  let filtered = riwayatList;
  if (startDate) filtered = filtered.filter(r => r.tglLunas >= startDate);
  if (endDate) filtered = filtered.filter(r => r.tglLunas <= endDate);
  
  if(filtered.length === 0) { toast("Tidak ada data untuk diekspor", "warn"); return; }
  
  // Format data untuk CSV
  const csvData = filtered.map(r => ({
    "Tanggal Lunas": r.tglLunas,
    "NOP": r.nop,
    "Nama Wajib Pajak": r.nama,
    "Tahun": r.tahun,
    "Petugas Penginput": r.petugas,
    "Metode Pembayaran": r.metodeBayar,
    "Disetujui Oleh": r.approvedBy
  }));
  
  exportToCSV(csvData, `Laporan_PBB_Kasomalang_Kulon_${startDate || 'All'}_sd_${endDate || 'All'}.csv`);
  toast("✅ File CSV berhasil diunduh!");
};

// ─── PETUGAS: DASHBOARD (STRICT RT FILTERING) ───
function buildPetugasDashboard() {
  if (!currentUser) return;
  const wilayahStr = currentUser.role === "kolektor" ? "Semua Wilayah" : `${currentUser.wilayah.dusun} / RW ${currentUser.wilayah.rw} / RT ${currentUser.wilayah.rt}`;
  el("petugas-greeting").textContent = `Halo, ${currentUser.nama} — ${wilayahStr}`;
  
  // STRICT FILTER: Hanya ambil data WP sesuai wilayah petugas
  const myWP = getWPByRole(currentUser, 2026);
  const s = { lunas: 0, belum: 0, pending: 0 };
  
  myWP.forEach(w => {
    const st = w.payments[2026];
    if (st === "lunas") s.lunas++;
    else if (st === "pending") s.pending++;
    else s.belum++;
  });
  
  el("pet-lunas").textContent = s.lunas;
  el("pet-belum").textContent = s.belum;
  el("pet-pending").textContent = s.pending;
  el("pet-total").textContent = myWP.length;
  
  el("petugas-wp-tbody").innerHTML = myWP.filter(w => w.payments[2026] !== "lunas").slice(0, 25).map(w => `<tr>
    <td class="mono">${shortNOP(w.nop)}</td><td><strong>${w.nama}</strong></td>
    <td>${statusBadge(w.payments[2026])}</td>
    <td><button class="btn btn-primary btn-sm" onclick="prefillBayar(${w.id})">Input Bayar</button></td>
  </tr>`).join("");
}

window.prefillBayar = function(id) {
  _selectedBayarWP = wpData.find(w => w.id === id);
  showSection("bayar-wp");
  if (_selectedBayarWP) {
    el("bayar-search").value = _selectedBayarWP.nama;
    showBayarInfo(_selectedBayarWP);
  }
};

// ─── PETUGAS: INPUT BAYAR (WITH METODE & KETERANGAN) ───
let _selectedBayarWP = null;
let _selectedBayarFile = null;

window.searchBayarWP = function() {
  const q = el("bayar-search").value.toLowerCase();
  const resultDiv = el("bayar-wp-result");
  if (!q) { resultDiv.innerHTML = ""; return; }
  
  // Filter juga berdasarkan wilayah jika petugas adalah RT
  let pool = wpData;
  if (currentUser.role === "rt") {
    pool = pool.filter(w => w.rt === currentUser.wilayah.rt && w.rw === currentUser.wilayah.rw);
  }
  
  const results = pool.filter(w => w.nama.toLowerCase().includes(q) || w.nop.includes(q)).slice(0, 6);
  if (!results.length) { resultDiv.innerHTML = `<p style="font-size:.8rem;color:var(--c-muted);padding:8px">Tidak ditemukan di wilayah Anda</p>`; return; }
  
  resultDiv.innerHTML = `<div style="border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;box-shadow:var(--shadow-sm)">
    ${results.map(w => `<div class="bayar-result-item" style="padding:10px 14px;cursor:pointer;font-size:.84rem;border-bottom:1px solid var(--c-border)" onclick="selectBayarWP(${w.id})">
      <strong>${w.nama}</strong> <span style="color:var(--c-muted);font-size:.78rem"> — ${shortNOP(w.nop)} — RT ${w.rt}</span>
      <div style="margin-top:4px">${statusBadge(w.payments[2026])}</div>
    </div>`).join("")}
  </div>`;
};

window.selectBayarWP = function(id) {
  _selectedBayarWP = wpData.find(w => w.id === id);
  el("bayar-search").value = _selectedBayarWP.nama;
  el("bayar-wp-result").innerHTML = "";
  showBayarInfo(_selectedBayarWP);
};

function showBayarInfo(w) {
  el("bayar-info-detail").innerHTML = `
    <div class="info-row"><label>NOP</label><strong class="mono" style="font-size:.78rem">${w.nop}</strong></div>
    <div class="info-row"><label>Nama</label><strong>${w.nama}</strong></div>
    <div class="info-row"><label>Lokasi</label><strong>${w.dusun} / RW ${w.rw} / RT ${w.rt}</strong></div>
    <div class="info-row"><label>Status 2026</label><strong>${statusBadge(w.payments[2026])}</strong></div>`;
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

window.submitBayar = function() {
  if (!_selectedBayarWP) { toast("Pilih wajib pajak terlebih dahulu!", "err"); return; }
  const tahun = parseInt(el("bayar-tahun").value);
  const metode = el("bayar-metode").value;
  const ket = el("bayar-keterangan").value;
  
  const currentStatus = _selectedBayarWP.payments[tahun];
  if (currentStatus === "lunas") { toast("WP ini sudah lunas untuk tahun " + tahun, "warn"); return; }
  if (currentStatus === "pending") { toast("Sudah ada pengajuan pending untuk tahun " + tahun, "warn"); return; }
  
  submitPayment({ wpId: _selectedBayarWP.id, tahun, petugasNama: currentUser.nama, metodeBayar: metode, keterangan: ket, file: _selectedBayarFile });
  toast("✅ Bukti bayar diupload! Menunggu approval admin.");
  
  _selectedBayarWP = null; _selectedBayarFile = null;
  el("bayar-search").value = "";
  el("bayar-wp-result").innerHTML = "";
  el("bayar-info-detail").innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>Upload berhasil! Menunggu approval Admin Desa.</p></div>`;
  el("bukti-preview").style.display = "none";
  el("bayar-keterangan").value = "";
};

// ─── MODALS & UTILS ───
export function openModal(id) { el(id)?.classList.add("open"); }
export function closeModal(id) { el(id)?.classList.remove("open"); }
window.openModal = openModal; window.closeModal = closeModal;
document.querySelectorAll(".modal-overlay").forEach(m => m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); }));

window.showPage = showPage; window.showSection = showSection;
window.doLogin = doLogin; window.handleLogout = handleLogout; window.quickLogin = quickLogin;

window.addEventListener("load", () => {
  setTimeout(() => {
    const ls = el("loading-screen");
    ls.style.opacity = "0";
    setTimeout(() => { ls.style.display = "none"; initPublic(); }, 600);
  }, 1200);
  
  const ham = el("hamburger");
  const sb = el("sidebar");
  if (ham && sb) ham.addEventListener("click", () => sb.classList.toggle("open"));
  el("login-pass")?.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
});
