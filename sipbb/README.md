# SIPBB – Sistem Informasi PBB Desa Kasomalang Kulon

Dashboard transparansi dan manajemen Pajak Bumi & Bangunan.

## Struktur Proyek

```
sipbb/
├── index.html          # Entry point
├── vercel.json         # Konfigurasi Vercel
├── css/
│   └── style.css       # Design system & semua style
└── js/
    ├── data.js         # BACKEND: data, state, business logic
    └── app.js          # FRONTEND: UI rendering, event handler, chart
```

## Pemisahan Frontend / Backend

| File | Tanggung Jawab |
|------|----------------|
| `js/data.js` | Data WP, autentikasi, approval, query/statistik |
| `js/app.js`  | Render HTML, chart, toast, navigasi, event handler |

`app.js` **hanya boleh** import dari `data.js` — tidak ada logika bisnis di `app.js`.

## Akun Demo

| Role        | Username    | Password      |
|-------------|-------------|---------------|
| Admin Desa  | admin       | admin123      |
| Kolektor    | kolektor1   | kolektor123   |
| Petugas RT  | rt001       | rt123         |

## Deploy ke Vercel

1. Push folder `sipbb/` ke GitHub (atau drag & drop di Vercel dashboard)
2. Di Vercel → **New Project** → pilih repo
3. Framework Preset: **Other** (ini static HTML)
4. Build Command: _(kosongkan)_
5. Output Directory: _(kosongkan atau tulis `.`)_
6. Klik **Deploy** ✅

> `vercel.json` sudah disiapkan agar semua route mengarah ke `index.html`.

## Bugs yang Diperbaiki

- **Nav ID mapping** — `showSection()` dulu pakai chain `.replace()` yang berantakan; sekarang pakai lookup object `NAV_MAP`.
- **Chart double-render** — `buildAdminDashboard` dulu tidak destroy chart sebelum rebuild; sekarang semua chart di-`destroyChart()` dulu.
- **Riwayat petugas** — filter dulu pakai `|| true` sehingga semua data muncul; sekarang filter by `p.petugas === currentUser.nama`.
- **Counter animasi** — dulu hardcoded 876/371/43; sekarang dihitung dari `wpData` aktual.
- **Submit bayar duplikat** — ditambahkan guard: tolak jika status sudah `lunas` atau `pending`.
- **Login page display** — `showPage('login')` dulu set `display: flex` manual tapi race condition; sekarang pakai CSS class `.active` dengan `display: flex !important`.
