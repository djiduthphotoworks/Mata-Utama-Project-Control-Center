/* ==========================================================================
   map.js — Peta ubin (slippy map) ringan untuk Project Control Center

   - Tanpa library dan tanpa kunci API/kredensial.
   - Ubin peta: OpenStreetMap, dimuat langsung oleh browser dari internet
     (https://tile.openstreetmap.org). Butuh koneksi internet; alamat IP perangkat
     terlihat oleh penyedia ubin seperti pada situs peta lain.
   - File ini TIDAK membaca data proyek. app.js yang memberi daftar penanda,
     sehingga mesin peta dapat diganti tanpa menyentuh logika aplikasi.
   - Koordinat yang ditampilkan adalah koordinat yang tersimpan di mockup
     (data demo) dan BELUM terverifikasi.

   API:
     const map = PCCMap.create(hostElement, options);
       options: { onSelect(id), onTileProblem(bool), tileUrl, attribution, labels }
     map.setMarkers([{ id, lat, lng, name, label, status, color }])
     map.select(id, { center: true })   -> true bila penanda punya koordinat
     map.fitAll()                        -> zoom agar semua penanda terlihat
     map.destroy()
   ========================================================================== */
(function (global) {
    'use strict';

    const TILE = 256, MIN_Z = 3, MAX_Z = 18;
    const DEFAULTS = {
        tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        center: { lat: -2.5, lng: 118 }, zoom: 4,
        onSelect: null, onTileProblem: null,
        labels: {
            map: 'Peta lokasi proyek. Geser untuk menggeser, roda mouse atau tombol + dan − untuk zoom.',
            zoomIn: 'Perbesar', zoomOut: 'Perkecil', fit: 'Tampilkan semua proyek',
            tileProblem: 'Ubin peta tidak dapat dimuat. Periksa koneksi internet. Bila halaman dibuka langsung dari file (file://), jalankan lewat server lokal (python3 -m http.server) agar OpenStreetMap menerima permintaan.'
        }
    };

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const worldSize = z => TILE * Math.pow(2, z);

    /* Proyeksi Web Mercator (EPSG:3857) ke piksel dunia pada zoom z */
    function project(lat, lng, z) {
        const s = worldSize(z), l = clamp(lat, -85.0511, 85.0511) * Math.PI / 180;
        return { x: (lng + 180) / 360 * s, y: (1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2 * s };
    }
    function unproject(x, y, z) {
        const s = worldSize(z), n = Math.PI - 2 * Math.PI * y / s;
        return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: x / s * 360 - 180 };
    }
    const validCoord = m => m && typeof m.lat === 'number' && typeof m.lng === 'number' && isFinite(m.lat) && isFinite(m.lng) && Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function create(host, options) {
        const o = Object.assign({}, DEFAULTS, options || {});
        o.labels = Object.assign({}, DEFAULTS.labels, (options && options.labels) || {});
        const st = { z: o.zoom, cx: 0, cy: 0, markers: [], sel: null, tiles: new Map(), pins: new Map(), ok: 0, err: 0, problem: false, raf: 0, pendingFit: false, sized: false, dead: false };

        host.classList.add('pcc-map');
        host.tabIndex = 0;
        host.setAttribute('role', 'application');
        host.setAttribute('aria-label', o.labels.map);
        host.innerHTML = `<div class="pcc-tiles" aria-hidden="true"></div><div class="pcc-pins"></div>
      <div class="pcc-ctrl">
        <button type="button" class="pcc-btn" data-z="1" aria-label="${esc(o.labels.zoomIn)}" title="${esc(o.labels.zoomIn)}">+</button>
        <button type="button" class="pcc-btn" data-z="-1" aria-label="${esc(o.labels.zoomOut)}" title="${esc(o.labels.zoomOut)}">−</button>
        <button type="button" class="pcc-btn" data-fit="1" aria-label="${esc(o.labels.fit)}" title="${esc(o.labels.fit)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="2.5"/></svg></button>
      </div>
      <div class="pcc-notice" role="status" hidden></div>
      <div class="pcc-attr">${o.attribution}</div>`;
        const tilesEl = host.querySelector('.pcc-tiles'), pinsEl = host.querySelector('.pcc-pins'), noticeEl = host.querySelector('.pcc-notice');
        noticeEl.textContent = o.labels.tileProblem;

        const size = () => ({ w: host.clientWidth, h: host.clientHeight });

        function setView(lat, lng, z) {
            st.z = clamp(Math.round(z), MIN_Z, MAX_Z);
            const p = project(lat, lng, st.z);
            st.cx = p.x; st.cy = p.y;
            schedule();
        }

        function zoomBy(dz, pt) {
            const nz = clamp(st.z + dz, MIN_Z, MAX_Z);
            if (nz === st.z) return;
            const { w, h } = size(), dx = pt ? pt.x - w / 2 : 0, dy = pt ? pt.y - h / 2 : 0, s = Math.pow(2, nz - st.z);
            st.cx = (st.cx + dx) * s - dx; st.cy = (st.cy + dy) * s - dy; st.z = nz;
            schedule();
        }

        function panBy(dx, dy) {
            st.cx += dx; st.cy = clamp(st.cy + dy, 0, worldSize(st.z));
            schedule();
        }

        function fitAll() {
            const pts = st.markers.filter(validCoord);
            const { w, h } = size();
            if (!pts.length) { setView(o.center.lat, o.center.lng, o.zoom); return; }
            if (pts.length === 1) { setView(pts[0].lat, pts[0].lng, 14); return; }
            const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
            const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
            const pad = 70, aw = Math.max(80, w - pad * 2), ah = Math.max(80, h - pad * 2);
            let z = MIN_Z;
            for (let t = 15; t >= MIN_Z; t--) {
                const a = project(maxLat, minLng, t), b = project(minLat, maxLng, t);
                if (Math.abs(b.x - a.x) <= aw && Math.abs(b.y - a.y) <= ah) { z = t; break; }
            }
            setView((minLat + maxLat) / 2, (minLng + maxLng) / 2, z);
        }

        function setProblem(v) {
            if (st.problem === v) return;
            st.problem = v; noticeEl.hidden = !v;
            if (typeof o.onTileProblem === 'function') o.onTileProblem(v);
        }

        function addTile(key, z, tx, ty, n) {
            const img = new Image();
            img.className = 'pcc-tile'; img.alt = ''; img.draggable = false; img.decoding = 'async';
            img.referrerPolicy = 'strict-origin-when-cross-origin';
            img.onload = () => { img.classList.add('is-loaded'); st.ok++; setProblem(false); };
            img.onerror = () => { if (!st.ok && ++st.err >= 3) setProblem(true); };
            img.src = o.tileUrl.replace('{z}', z).replace('{x}', ((tx % n) + n) % n).replace('{y}', ty);
            tilesEl.appendChild(img); st.tiles.set(key, img);
        }

        function render() {
            st.raf = 0;
            if (st.dead) return;
            const { w, h } = size(); if (!w || !h) return;
            const z = st.z, n = Math.pow(2, z);
            const ox = Math.round(st.cx - w / 2), oy = Math.round(st.cy - h / 2);
            const x0 = Math.floor(ox / TILE) - 1, x1 = Math.floor((ox + w) / TILE) + 1, y0 = Math.max(0, Math.floor(oy / TILE) - 1), y1 = Math.min(n - 1, Math.floor((oy + h) / TILE) + 1);
            const need = new Set();
            for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
                const key = `${z}/${tx}/${ty}`; need.add(key);
                if (!st.tiles.has(key)) addTile(key, z, tx, ty, n);
                st.tiles.get(key).style.transform = `translate(${tx * TILE - ox}px, ${ty * TILE - oy}px)`;
            }
            st.tiles.forEach((img, key) => { if (!need.has(key)) { img.remove(); st.tiles.delete(key); } });
            st.pins.forEach((el, id) => {
                const m = st.markers.find(x => x.id === id); if (!m) return;
                const p = project(m.lat, m.lng, z), left = p.x - ox, top = p.y - oy;
                el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
                el.style.zIndex = id === st.sel ? 1000 : Math.round(top);
                el.classList.toggle('flip', left > w - 200);
            });
        }
        function schedule() { if (!st.raf) st.raf = requestAnimationFrame(render); }

        function buildPins() {
            pinsEl.innerHTML = ''; st.pins.clear();
            st.markers.filter(validCoord).forEach(m => {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'pcc-pin'; b.dataset.id = m.id;
                b.setAttribute('aria-label', `${m.name || m.label || m.id}${m.status ? ', ' + m.status : ''}`);
                b.innerHTML = `<span class="pcc-dot" style="background:${esc(m.color || '#2563eb')}"></span><span class="pcc-tag"></span>`;
                pinsEl.appendChild(b); st.pins.set(m.id, b);
            });
            paintSelection();
        }
        function paintSelection() {
            st.pins.forEach((el, id) => {
                const m = st.markers.find(x => x.id === id), on = id === st.sel;
                el.classList.toggle('is-selected', on);
                el.setAttribute('aria-pressed', on ? 'true' : 'false');
                el.querySelector('.pcc-tag').textContent = on ? (m.name || m.label || '') : (m.label || '');
            });
        }

        /* ---------- interaksi ---------- */
        const ptrs = new Map(); let pinch = null;
        const local = e => { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        const ignore = e => e.target.closest('.pcc-pin, .pcc-ctrl, .pcc-attr, .pcc-notice');

        host.addEventListener('pointerdown', e => {
            if (ignore(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
            ptrs.set(e.pointerId, local(e));
            try { host.setPointerCapture(e.pointerId); } catch (_) { /* diabaikan */ }
            host.classList.add('is-dragging');
            if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
        });
        host.addEventListener('pointermove', e => {
            if (!ptrs.has(e.pointerId)) return;
            const prev = ptrs.get(e.pointerId), cur = local(e);
            ptrs.set(e.pointerId, cur);
            if (ptrs.size === 1) panBy(prev.x - cur.x, prev.y - cur.y);
            else if (ptrs.size === 2 && pinch) {
                const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                if (d / pinch.d >= 1.6) { zoomBy(1, mid); pinch.d = d; } else if (d / pinch.d <= 0.62) { zoomBy(-1, mid); pinch.d = d; }
            }
        });
        const endPtr = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) host.classList.remove('is-dragging'); };
        host.addEventListener('pointerup', endPtr);
        host.addEventListener('pointercancel', endPtr);

        let lastWheel = 0;
        host.addEventListener('wheel', e => {
            e.preventDefault();
            const now = Date.now(); if (now - lastWheel < 220) return;
            lastWheel = now; zoomBy(e.deltaY < 0 ? 1 : -1, local(e));
        }, { passive: false });
        host.addEventListener('dblclick', e => { if (!ignore(e)) zoomBy(1, local(e)); });

        host.addEventListener('keydown', e => {
            if (e.target !== host) return;
            const k = e.key, step = 80;
            if (k === 'ArrowLeft') panBy(-step, 0); else if (k === 'ArrowRight') panBy(step, 0);
            else if (k === 'ArrowUp') panBy(0, -step); else if (k === 'ArrowDown') panBy(0, step);
            else if (k === '+' || k === '=') zoomBy(1); else if (k === '-' || k === '_') zoomBy(-1);
            else if (k === 'Home') fitAll(); else return;
            e.preventDefault();
        });

        host.addEventListener('click', e => {
            const btn = e.target.closest('.pcc-btn');
            if (btn) { if (btn.dataset.fit) fitAll(); else zoomBy(Number(btn.dataset.z)); return; }
            const pin = e.target.closest('.pcc-pin');
            if (pin && typeof o.onSelect === 'function') o.onSelect(pin.dataset.id);
        });

        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
            if (!st.sized && host.clientWidth) { st.sized = true; if (st.pendingFit) { st.pendingFit = false; fitAll(); } }
            schedule();
        }) : null;
        if (ro) ro.observe(host);

        setView(o.center.lat, o.center.lng, o.zoom);

        return {
            setMarkers(list, opts) {
                st.markers = (list || []).filter(validCoord);
                buildPins();
                if (opts && opts.fit) { if (size().w) fitAll(); else st.pendingFit = true; }
                schedule();
            },
            select(id, opts) {
                st.sel = id; paintSelection();
                const m = st.markers.find(x => x.id === id);
                if (!m) { schedule(); return false; }
                if (opts && opts.center) setView(m.lat, m.lng, Math.max(st.z, 13));
                schedule(); return true;
            },
            fitAll, zoomBy, setView,
            get zoom() { return st.z; },
            get hasTileProblem() { return st.problem; },
            destroy() {
                st.dead = true; if (ro) ro.disconnect(); if (st.raf) cancelAnimationFrame(st.raf);
                st.tiles.clear(); st.pins.clear(); host.innerHTML = ''; host.classList.remove('pcc-map', 'is-dragging');
            }
        };
    }

    global.PCCMap = { create, project, unproject, TILE_SIZE: TILE };
})(window);