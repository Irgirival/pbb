// ============================================================
//  SIPBB – Backend / Data Layer
//  Semua data, state global, dan business logic ada di sini.
//  Frontend (app.js) hanya boleh memanggil fungsi dari file ini.
// ============================================================

"use strict";

// ─── KONSTANTA ───────────────────────────────────────────────
export const TAHUN_LIST = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export const DUSUN_DATA = [
  { nama: "Dusun Kidul",  rw: ["001","002"],       rt: ["001","002","003","004"], target: 180 },
  { nama: "Dusun Kulon",  rw: ["003","004"],       rt: ["005","006","007"],       target: 210 },
  { nama: "Dusun Wetan",  rw: ["005"],             rt: ["008","009","010"],       target: 165 },
  { nama: "Dusun Kaler",  rw: ["006","007"],       rt: ["011","012","013","014"], target: 220 },
  { nama: "Dusun Tengah", rw: ["008"],             rt: ["015","016"],             target: 140 },
  { nama: "Dusun Girang", rw: ["009"],             rt: ["017","018","019"],       target: 170 },
  { nama: "Dusun Hilir",  rw: ["010","011"],       rt: ["020","021","022"],       target: 162 },
];

// ─── GENERATOR HELPERS ───────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function seededRnd(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function rndName() {
  const first = ["Asep","Dedi","Yusuf","Siti","Neng","Ujang","Imas","Dadang","Rina","Hendra","Cucu","Ade","Rini","Budi","Sri","Jajang","Euis","Tatang","Yuyun","Rahmat","Iwan","Nina","Tono","Wati","Ridwan"];
  const last  = ["Suparman","Hidayat","Permana","Santoso","Rahayu","Susilawati","Kurniawan","Wibowo","Nugraha","Setiawan","Maulana","Gunawan","Sukma","Purnama","Cahyadi","Firmansyah","Hamdani","Iskandar","Junaedi"];
  return first[rnd(0, first.length - 1)] + " " + last[rnd(0, last.length - 1)];
}

// Estimasi nominal PBB per WP (dummy, untuk tampilan Rp tunggakan)
function rndPajak(seed) {
  const base = 23000;
  const r = seededRnd(seed * 7.3);
  return base + Math.floor(r * 250000);
}

// ─── GENERATE DATA WP ────────────────────────────────────────
export const wpData = [];
let _wpId = 1;

DUSUN_DATA.forEach((d, di) => {
  for (let i = 0; i < d.target; i++) {
    const rw  = d.rw[i % d.rw.length];
    const rt  = d.rt[i % d.rt.length];
    const nop = `32.${String(di + 1).padStart(2,"0")}.${String(rnd(100,999))}.${String(rnd(100,999))}.${String(rnd(100,999))}-${String(rnd(1000,9999))}.${rnd(0,9)}`;

    const payments = {};
    const nominal  = {};
    TAHUN_LIST.forEach((y, yi) => {
      const r = seededRnd(_wpId * 100 + yi);
      if (y < 2025)      payments[y] = r > 0.10 ? "lunas" : "tunggakan";
      else if (y === 2025) payments[y] = r > 0.15 ? "lunas" : r > 0.07 ? "pending" : "tunggakan";
      else                 payments[y] = r > 0.30 ? "lunas" : r > 0.15 ? "pending" : "tunggakan";
      nominal[y] = rndPajak(_wpId * 10 + yi);
    });

    wpData.push({ id: _wpId++, nop, nama: rndName(), dusun: d.nama, rw, rt, payments, nominal });
  }
});

// ─── PENDING UPLOADS ─────────────────────────────────────────
export const pendingList = [];
wpData
  .filter(w => w.payments[2026] === "pending" || w.payments[2025] === "pending")
  .slice(0, 43)
  .forEach((w, i) => {
    const tahun = w.payments[2026] === "pending" ? 2026 : 2025;
    pendingList.push({
      id: i + 1,
      nop: w.nop,
      nama: w.nama,
      tahun,
      petugas: ["RT 001","RT 002","Kolektor","RT 003"][i % 4],
      tanggal: `${rnd(1,28)}/0${rnd(1,6)}/2026`,
      status: "pending",
      buktiUrl: null,
      ketAdmin: "",
      wpRef: w,
    });
  });

// ─── RIWAYAT LUNAS ───────────────────────────────────────────
export const riwayatList = [];
wpData
  .filter(w => w.payments[2026] === "lunas")
  .slice(0, 60)
  .forEach((w, i) => {
    riwayatList.push({
      id: i + 1,
      nop: w.nop,
      nama: w.nama,
      tahun: 2026,
      petugas: ["RT 001","Kolektor","RT 002"][i % 3],
      tglLunas: `${rnd(1,28)}/0${rnd(1,5)}/2026`,
      approvedBy: "Admin Desa",
    });
  });

// ─── PETUGAS ─────────────────────────────────────────────────
export const petugasList = [
  { id:1, nama:"Asep Kurniawan", username:"rt001",      password:"rt123",        role:"rt",       wilayah:"Dusun Kidul / RW 001 / RT 001", totalUpload:45 },
  { id:2, nama:"Dedi Permana",   username:"rt002",      password:"rt123",        role:"rt",       wilayah:"Dusun Kulon / RW 003 / RT 005", totalUpload:38 },
  { id:3, nama:"Hendra Santoso", username:"kolektor1",  password:"kolektor123",  role:"kolektor", wilayah:"Semua Dusun",                   totalUpload:122 },
  { id:4, nama:"Ujang Maulana",  username:"rt003",      password:"rt123",        role:"rt",       wilayah:"Dusun Wetan / RW 005 / RT 008", totalUpload:29 },
];

export const users = [
  { username:"admin", password:"admin123", role:"admin", nama:"Admin Desa", wilayah:"" },
  ...petugasList.map(p => ({ username:p.username, password:p.password, role:p.role, nama:p.nama, wilayah:p.wilayah })),
];

// ─── STATE ───────────────────────────────────────────────────
export let currentUser = null;

// ─── AUTH API ────────────────────────────────────────────────
export function login(role, username, password) {
  const found = users.find(u => u.username === username && u.password === password && u.role === role);
  if (!found) return null;
  currentUser = found;
  return found;
}

export function logout() {
  currentUser = null;
}

// ─── PAYMENT API ─────────────────────────────────────────────

/** Approve atau tolak item pending. Returns updated item atau null jika gagal. */
export function processApproval(id, approved, approvedBy) {
  const p = pendingList.find(x => x.id === id);
  if (!p || p.status !== "pending") return null;

  p.status    = approved ? "lunas" : "rejected";
  p.ketAdmin  = approved ? `Disetujui oleh ${approvedBy}` : `Ditolak oleh ${approvedBy}`;

  if (approved && p.wpRef) {
    p.wpRef.payments[p.tahun] = "lunas";
    riwayatList.unshift({
      id: riwayatList.length + 1,
      nop: p.nop,
      nama: p.nama,
      tahun: p.tahun,
      petugas: p.petugas,
      tglLunas: new Date().toLocaleDateString("id-ID"),
      approvedBy,
    });
  }
  return p;
}

/** Upload bukti bayar baru dari petugas. */
export function submitPayment({ wpId, tahun, petugasNama, file }) {
  const wp = wpData.find(w => w.id === wpId);
  if (!wp) return null;

  const item = {
    id: pendingList.length + 1,
    nop: wp.nop,
    nama: wp.nama,
    tahun,
    petugas: petugasNama,
    tanggal: new Date().toLocaleDateString("id-ID"),
    status: "pending",
    buktiUrl: file ? URL.createObjectURL(file) : null,
    ketAdmin: "",
    wpRef: wp,
  };
  pendingList.unshift(item);
  wp.payments[tahun] = "pending";
  return item;
}

/** Tambah WP baru. */
export function addWP({ nop, nama, dusun, rw, rt }) {
  const newWP = {
    id: wpData.length + 1,
    nop, nama, dusun, rw, rt,
    payments: Object.fromEntries(TAHUN_LIST.map(y => [y, "tunggakan"])),
    nominal:  Object.fromEntries(TAHUN_LIST.map(y => [y, 23000])),
  };
  wpData.push(newWP);
  return newWP;
}

/** Tambah petugas baru. */
export function addPetugas({ nama, username, password, role, wilayah }) {
  const p = { id: petugasList.length + 1, nama, username, password, role, wilayah, totalUpload: 0 };
  petugasList.push(p);
  users.push({ username, password, role, nama, wilayah });
  return p;
}

// ─── QUERY / STATISTIK ───────────────────────────────────────

export function getStats(tahun = 2026) {
  const total   = wpData.length;
  const lunas   = wpData.filter(w => w.payments[tahun] === "lunas").length;
  const pending = wpData.filter(w => w.payments[tahun] === "pending").length;
  const tunggak = total - lunas - pending;
  const persen  = Math.round((lunas / total) * 100);
  return { total, lunas, pending, tunggak, persen };
}

export function getTrenData() {
  return TAHUN_LIST.map(y => {
    const { lunas, total } = getStats(y);
    return Math.round((lunas / total) * 100);
  });
}

export function getDusunStats(tahun = 2026) {
  return DUSUN_DATA.map(d => {
    const all     = wpData.filter(w => w.dusun === d.nama);
    const lunas   = all.filter(w => w.payments[tahun] === "lunas").length;
    const pending = all.filter(w => w.payments[tahun] === "pending").length;
    const tunggak = all.length - lunas - pending;
    const persen  = Math.round((lunas / all.length) * 100);
    const totalRp = all.filter(w => w.payments[tahun] === "tunggakan")
                        .reduce((s,w) => s + (w.nominal?.[tahun] || 0), 0);
    return { ...d, total: all.length, lunas, pending, tunggak, persen, totalRp };
  });
}

export function getRWStats(tahun = 2026) {
  const map = {};
  wpData.forEach(w => {
    if (!map[w.rw]) map[w.rw] = { lunas: 0, tunggak: 0, pending: 0, total: 0 };
    map[w.rw].total++;
    if (w.payments[tahun] === "lunas")      map[w.rw].lunas++;
    else if (w.payments[tahun] === "pending") map[w.rw].pending++;
    else                                     map[w.rw].tunggak++;
  });
  return map;
}

export function getRTStats(tahun = 2026) {
  const map = {};
  wpData.forEach(w => {
    if (!map[w.rt]) map[w.rt] = { lunas: 0, total: 0 };
    map[w.rt].total++;
    if (w.payments[tahun] === "lunas") map[w.rt].lunas++;
  });
  return map;
}

export function searchWP(query = "", filterDusun = "", filterStatus = "", limit = 100) {
  const q = query.toLowerCase();
  return wpData
    .filter(w => {
      const matchQ  = !q || w.nama.toLowerCase().includes(q) || w.nop.includes(q);
      const matchD  = !filterDusun || w.dusun === filterDusun;
      const matchS  = !filterStatus || w.payments[2026] === filterStatus;
      return matchQ && matchD && matchS;
    })
    .slice(0, limit);
}

export function getTunggakanList() {
  return wpData.filter(w => TAHUN_LIST.some(y => w.payments[y] === "tunggakan"));
}

export function getPendingApprovals() {
  return pendingList.filter(p => p.status === "pending");
}

// ─── ANALYTICS: TUNGGAKAN PER DUSUN / RW / RT (untuk dashboard publik) ─────

/**
 * Ringkasan tunggakan untuk tahun tertentu, dikelompokkan per dusun.
 * Tiap dusun berisi breakdown per RW, dan tiap RW berisi breakdown per RT.
 * Hanya menghitung WP dengan status "tunggakan" pada tahun tsb.
 */
export function getTunggakanBreakdown(tahun = 2026) {
  return DUSUN_DATA.map(d => {
    const wpDusun = wpData.filter(w => w.dusun === d.nama && w.payments[tahun] === "tunggakan");
    const totalRp = wpDusun.reduce((s, w) => s + (w.nominal?.[tahun] || 0), 0);

    const rwMap = {};
    wpDusun.forEach(w => {
      if (!rwMap[w.rw]) rwMap[w.rw] = { rw: w.rw, items: [], totalRp: 0 };
      rwMap[w.rw].items.push(w);
      rwMap[w.rw].totalRp += (w.nominal?.[tahun] || 0);
    });

    const rwList = Object.values(rwMap).map(rwEntry => {
      const rtMap = {};
      rwEntry.items.forEach(w => {
        if (!rtMap[w.rt]) rtMap[w.rt] = { rt: w.rt, wp: 0, totalRp: 0 };
        rtMap[w.rt].wp++;
        rtMap[w.rt].totalRp += (w.nominal?.[tahun] || 0);
      });
      const rtList = Object.values(rtMap).sort((a,b) => a.rt.localeCompare(b.rt, undefined, {numeric:true}));
      return { rw: rwEntry.rw, wp: rwEntry.items.length, totalRp: rwEntry.totalRp, rtList };
    }).sort((a,b) => a.rw.localeCompare(b.rw, undefined, {numeric:true}));

    return { dusun: d.nama, wp: wpDusun.length, totalRp, rwList };
  });
}

/**
 * Daftar WP tunggakan untuk tahun tertentu, dengan filter opsional
 * dusun / rw / rt. Mengembalikan data flat siap ditampilkan di tabel.
 */
export function getTunggakanWP(tahun = 2026, { dusun = "", rw = "", rt = "" } = {}) {
  return wpData.filter(w => {
    if (w.payments[tahun] !== "tunggakan") return false;
    if (dusun && w.dusun !== dusun) return false;
    if (rw && w.rw !== rw) return false;
    if (rt && w.rt !== rt) return false;
    return true;
  }).map(w => ({
    id: w.id, nop: w.nop, nama: w.nama, dusun: w.dusun, rw: w.rw, rt: w.rt,
    nominal: w.nominal?.[tahun] || 0,
    payments: w.payments,
  }));
}

/** Total tunggakan (Rp) seluruh desa untuk tahun tertentu. */
export function getTotalTunggakanRp(tahun = 2026) {
  return wpData
    .filter(w => w.payments[tahun] === "tunggakan")
    .reduce((s, w) => s + (w.nominal?.[tahun] || 0), 0);
}

/** Daftar RW unik untuk dropdown filter, opsional dibatasi ke 1 dusun. */
export function getRWList(dusunNama = "") {
  const d = DUSUN_DATA.find(x => x.nama === dusunNama);
  if (d) return [...d.rw];
  return [...new Set(wpData.map(w => w.rw))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

/** Daftar RT unik untuk dropdown filter, dibatasi ke 1 RW (opsional dusun). */
export function getRTList(rwVal = "", dusunNama = "") {
  let pool = wpData;
  if (dusunNama) pool = pool.filter(w => w.dusun === dusunNama);
  if (rwVal) pool = pool.filter(w => w.rw === rwVal);
  return [...new Set(pool.map(w => w.rt))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
