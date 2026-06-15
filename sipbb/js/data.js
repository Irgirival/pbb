"use strict";

export const TAHUN_LIST = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const DUSUN_DATA = [
  { nama: "Dusun Kidul", rw: ["001", "002"], rt: ["001", "002", "003", "004"], target: 180 },
  { nama: "Dusun Kulon", rw: ["003", "004"], rt: ["005", "006", "007"], target: 210 },
  { nama: "Dusun Wetan", rw: ["005"], rt: ["008", "009", "010"], target: 165 },
  { nama: "Dusun Kaler", rw: ["006", "007"], rt: ["011", "012", "013", "014"], target: 220 },
  { nama: "Dusun Tengah", rw: ["008"], rt: ["015", "016"], target: 140 },
  { nama: "Dusun Girang", rw: ["009"], rt: ["017", "018", "019"], target: 170 },
  { nama: "Dusun Hilir", rw: ["010", "011"], rt: ["020", "021", "022"], target: 162 },
];

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function seededRnd(seed) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function rndName() {
  const first = ["Asep", "Dedi", "Yusuf", "Siti", "Neng", "Ujang", "Imas", "Dadang", "Rina", "Hendra", "Cucu", "Ade", "Rini", "Budi", "Sri", "Jajang", "Euis", "Tatang", "Yuyun", "Rahmat", "Iwan", "Nina", "Tono", "Wati", "Ridwan"];
  const last = ["Suparman", "Hidayat", "Permana", "Santoso", "Rahayu", "Susilawati", "Kurniawan", "Wibowo", "Nugraha", "Setiawan", "Maulana", "Gunawan", "Sukma", "Purnama", "Cahyadi", "Firmansyah", "Hamdani", "Iskandar", "Junaedi"];
  return first[rnd(0, first.length - 1)] + " " + last[rnd(0, last.length - 1)];
}
function rndPajak(seed) {
  const base = 23000; const r = seededRnd(seed * 7.3);
  return base + Math.floor(r * 250000);
}

export const wpData = [];
let _wpId = 1;
DUSUN_DATA.forEach((d, di) => {
  for (let i = 0; i < d.target; i++) {
    const rw = d.rw[i % d.rw.length];
    const rt = d.rt[i % d.rt.length];
    const nop = `32.${String(di + 1).padStart(2,"0")}.${String(rnd(100,999))}.${String(rnd(100,999))}.${String(rnd(100,999))}-${String(rnd(1000,9999))}.${rnd(0,9)}`;
    const payments = {}; const nominal = {};
    TAHUN_LIST.forEach((y, yi) => {
      const r = seededRnd(_wpId * 100 + yi);
      if (y < 2025) payments[y] = r > 0.10 ? "lunas" : "tunggakan";
      else if (y === 2025) payments[y] = r > 0.15 ? "lunas" : r > 0.07 ? "pending" : "tunggakan";
      else payments[y] = r > 0.30 ? "lunas" : r > 0.15 ? "pending" : "tunggakan";
      nominal[y] = rndPajak(_wpId * 10 + yi);
    });
    wpData.push({ id: _wpId++, nop, nama: rndName(), dusun: d.nama, rw, rt, payments, nominal });
  }
});

export const pendingList = [];
wpData.filter(w => w.payments[2026] === "pending" || w.payments[2025] === "pending").slice(0, 43).forEach((w, i) => {
  const tahun = w.payments[2026] === "pending" ? 2026 : 2025;
  pendingList.push({
    id: i + 1, nop: w.nop, nama: w.nama, tahun,
    petugas: ["RT 001", "RT 002", "Kolektor", "RT 003"][i % 4],
    tanggal: `${rnd(1,28)}/0${rnd(1,6)}/2026`, status: "pending",
    metodeBayar: ["Transfer Bank", "Bayar di RT", "Bayar di Kolektor"][i % 3],
    keterangan: "Pembayaran via aplikasi desa", buktiUrl: null, ketAdmin: "", wpRef: w,
  });
});

export const riwayatList = [];
wpData.filter(w => w.payments[2026] === "lunas").slice(0, 60).forEach((w, i) => {
  riwayatList.push({
    id: i + 1, nop: w.nop, nama: w.nama, tahun: 2026,
    petugas: ["RT 001", "Kolektor", "RT 002"][i % 3],
    tglLunas: `2026-0${rnd(1,5)}-${String(rnd(1,28)).padStart(2,'0')}`,
    metodeBayar: ["Transfer Bank", "Bayar di RT", "Bayar di Kolektor"][i % 3],
    approvedBy: "Admin Desa",
  });
});

export const petugasList = [
  { id:1, nama: "Asep Kurniawan", username: "rt001", password: "rt123", role: "rt", wilayah: { dusun: "Dusun Kidul", rw: "001", rt: "001" }, totalUpload: 45 },
  { id:2, nama: "Dedi Permana", username: "rt002", password: "rt123", role: "rt", wilayah: { dusun: "Dusun Kulon", rw: "003", rt: "005" }, totalUpload: 38 },
  { id:3, nama: "Hendra Santoso", username: "kolektor1", password: "kolektor123", role: "kolektor", wilayah: { dusun: "Semua Dusun", rw: "ALL", rt: "ALL" }, totalUpload: 122 },
];

export const users = [
  { username: "admin", password: "admin123", role: "admin", nama: "Admin Desa", wilayah: { dusun: "ALL", rw: "ALL", rt: "ALL" } },
  ...petugasList.map(p => ({ username: p.username, password: p.password, role: p.role, nama: p.nama, wilayah: p.wilayah })),
];

export let currentUser = null;

export function login(role, username, password) {
  const found = users.find(u => u.username === username && u.password === password && u.role === role);
  if (!found) return null;
  currentUser = found;
  return found;
}
export function logout() { currentUser = null; }

export function processApproval(id, approved, approvedBy) {
  const p = pendingList.find(x => x.id === id);
  if (!p || p.status !== "pending") return null;
  p.status = approved ? "lunas" : "rejected";
  p.ketAdmin = approved ? `Disetujui oleh ${approvedBy}` : `Ditolak oleh ${approvedBy}`;
  if (approved && p.wpRef) {
    p.wpRef.payments[p.tahun] = "lunas";
    riwayatList.unshift({
      id: riwayatList.length + 1, nop: p.nop, nama: p.nama, tahun: p.tahun,
      petugas: p.petugas, tglLunas: new Date().toISOString().split('T')[0],
      metodeBayar: p.metodeBayar, approvedBy,
    });
  }
  return p;
}

export function submitPayment({ wpId, tahun, petugasNama, metodeBayar, keterangan, file }) {
  const wp = wpData.find(w => w.id === wpId);
  if (!wp) return null;
  const item = {
    id: pendingList.length + 1, nop: wp.nop, nama: wp.nama, tahun, petugas: petugasNama,
    tanggal: new Date().toISOString().split('T')[0], status: "pending",
    metodeBayar, keterangan, buktiUrl: file ? URL.createObjectURL(file) : null,
    ketAdmin: "", wpRef: wp,
  };
  pendingList.unshift(item);
  wp.payments[tahun] = "pending";
  return item;
}

export function addWP({ nop, nama, dusun, rw, rt }) {
  const newWP = {
    id: wpData.length + 1, nop, nama, dusun, rw, rt,
    payments: Object.fromEntries(TAHUN_LIST.map(y => [y, "tunggakan"])),
    nominal: Object.fromEntries(TAHUN_LIST.map(y => [y, 23000])),
  };
  wpData.push(newWP);
  return newWP;
}

export function getStats(tahun = 2026) {
  const total = wpData.length;
  const lunas = wpData.filter(w => w.payments[tahun] === "lunas").length;
  const pending = wpData.filter(w => w.payments[tahun] === "pending").length;
  const tunggak = total - lunas - pending;
  return { total, lunas, pending, tunggak, persen: Math.round((lunas / total) * 100) };
}

export function getTrenData() {
  return TAHUN_LIST.map(y => {
    const { lunas, total } = getStats(y);
    return Math.round((lunas / total) * 100);
  });
}

export function getDusunStats(tahun = 2026) {
  return DUSUN_DATA.map(d => {
    const all = wpData.filter(w => w.dusun === d.nama);
    const lunas = all.filter(w => w.payments[tahun] === "lunas").length;
    const pending = all.filter(w => w.payments[tahun] === "pending").length;
    const tunggak = all.length - lunas - pending;
    return { ...d, total: all.length, lunas, pending, tunggak, persen: Math.round((lunas / all.length) * 100) };
  });
}

// FUNGSI PENTING: Filter data berdasarkan Role & Wilayah Petugas
export function getWPByRole(user, tahun = 2026) {
  if (user.role === "admin" || user.role === "kolektor") return wpData;
  // Jika RT, filter ketat hanya untuk RT-nya
  return wpData.filter(w => w.rt === user.wilayah.rt && w.rw === user.wilayah.rw);
}

export function searchWP(query = "", filterDusun = "", filterStatus = "", limit = 100) {
  const q = query.toLowerCase();
  return wpData.filter(w => {
    const matchQ = !q || w.nama.toLowerCase().includes(q) || w.nop.includes(q);
    const matchD = !filterDusun || w.dusun === filterDusun;
    const matchS = !filterStatus || w.payments[2026] === filterStatus;
    return matchQ && matchD && matchS;
  }).slice(0, limit);
}

export function getPendingApprovals() { return pendingList.filter(p => p.status === "pending"); }

// FUNGSI EXPORT CSV UNTUK ADMIN
export function exportToCSV(data, filename) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName], (key, value) => value === null ? "" : value)).join(","))
  ].join("\r\n");
  
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
