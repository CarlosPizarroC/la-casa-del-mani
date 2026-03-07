import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/* =========================
   Firebase
   ========================= */
const firebaseConfig = {
    apiKey: "AIzaSyBQzhm2ItXJAFRhbvvR3W1sVtiOkHtZyI8",
    authDomain: "la-casa-del-mani.firebaseapp.com",
    projectId: "la-casa-del-mani",
    storageBucket: "la-casa-del-mani.firebasestorage.app",
    messagingSenderId: "87744421268",
    appId: "1:87744421268:web:86a41f87a95a3e01728381",
    measurementId: "G-LWSGS2WBD3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

/* =========================
   Helpers
   ========================= */
function setToast(el, msg, type = "ok") {
    if (!el) return;
    el.textContent = msg;
    el.className = "toast " + (type === "ok" ? "toast--ok" : "toast--error");
}
function resetToast(el) {
    if (!el) return;
    el.textContent = "";
    el.className = "toast";
}
function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(v).trim());
}
function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
function uid() {
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

/* =========================
   Logos (imagen/LOGO.*)
   ========================= */
const logoCandidates = ["imagen/LOGO.png", "imagen/LOGO.jpg", "imagen/LOGO.jpeg", "imagen/LOGO.webp", "imagen/LOGO.svg"];
function loadLogoInto(imgEl) {
    if (!imgEl) return;
    let i = 0;
    const tryNext = () => {
        if (i >= logoCandidates.length) { imgEl.style.display = "none"; return; }
        const src = logoCandidates[i++];
        const t = new Image();
        t.onload = () => imgEl.src = src;
        t.onerror = tryNext;
        t.src = src;
    };
    tryNext();
}
loadLogoInto($("brandLogo"));
loadLogoInto($("brandLogoMini"));

/* =========================
   Routing app/login
   ========================= */
function basePath() { return window.location.pathname; }
function isAppMode() { return new URLSearchParams(window.location.search).get("app") === "1"; }
function goApp(view = "#inicio") { window.location.replace(`${basePath()}?app=1${view}`); }
function goLogin() { window.location.replace(`${basePath()}`); }

/* =========================
   Firestore profile
   ========================= */
async function loadProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data();
}

/* =========================
   Local data
   ========================= */
const LS = {
    inventory: "lcm_inventory_v2",
    raw: "lcm_raw_v2",
    orders: "lcm_orders_v2",
    prod: "lcm_prod_orders_v2",
    recipes: "lcm_recipes_100bags_v1",
    control: "lcm_control_flow_v2",
};

function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

/* Migrations from old keys if exist */
function migrateIfNeeded() {
    // Inventory old key
    const oldInv = localStorage.getItem("lcm_inventory");
    if (oldInv && !localStorage.getItem(LS.inventory)) {
        const arr = JSON.parse(oldInv);
        const inv2 = (Array.isArray(arr) ? arr : []).map(x => ({
            id: x.id || uid(),
            name: x.name || "Producto",
            qty: Number(x.qty ?? 0),
            capacity: Number(x.capacity ?? 500),
        }));
        save(LS.inventory, inv2);
    }

    // Raw old key (strings) -> objects
    const oldRaw = localStorage.getItem("lcm_raw_materials");
    if (oldRaw && !localStorage.getItem(LS.raw)) {
        const arr = JSON.parse(oldRaw);
        const raw2 = (Array.isArray(arr) ? arr : []).map(x => {
            if (typeof x === "string") {
                return { id: uid(), name: x, qty: 0, capacity: 1000, unit: "kg" };
            }
            return {
                id: x.id || uid(),
                name: x.name || "MP",
                qty: Number(x.qty ?? 0),
                capacity: Number(x.capacity ?? 1000),
                unit: x.unit || "kg",
            };
        });
        save(LS.raw, raw2);
    }
}

function seedIfNeeded() {
    if (!localStorage.getItem(LS.inventory)) {
        save(LS.inventory, [
            { id: "mani_salado", name: "Maní salado", qty: 165, capacity: 500 },
            { id: "mani_dulce", name: "Maní dulce", qty: 90, capacity: 500 },
            { id: "mani_pasas", name: "Maní con pasas", qty: 60, capacity: 400 },
        ]);
    }

    if (!localStorage.getItem(LS.raw)) {
        save(LS.raw, [
            { id: uid(), name: "Maní tostado", qty: 120, capacity: 500, unit: "kg" },
            { id: uid(), name: "Sal", qty: 40, capacity: 200, unit: "kg" },
            { id: uid(), name: "Azúcar", qty: 60, capacity: 300, unit: "kg" },
            { id: uid(), name: "Pasas", qty: 25, capacity: 150, unit: "kg" },
            { id: uid(), name: "Aceite", qty: 30, capacity: 200, unit: "L" },
        ]);
    }

    if (!localStorage.getItem(LS.orders)) save(LS.orders, []);
    if (!localStorage.getItem(LS.prod)) save(LS.prod, []);

    if (!localStorage.getItem(LS.recipes)) {
        save(LS.recipes, {
            salado: {
                name: "Maní salado",
                bags: 100,
                ingredients: [
                    { name: "Maní tostado", qty: 970, unit: "g" },
                    { name: "Sal", qty: 15, unit: "g" },
                    { name: "Aceite", qty: 15, unit: "g" },
                ],
                params: {
                    densidad: 0.0,
                    premezcladoMin: 10,
                    tempPrecalentamientoC: 60,
                    tiempoPrecalentamientoMin: 10,
                    tiempoMezcladoMin: 15,
                    tempCalentamientoC: 120,
                }
            },
            dulce: {
                name: "Maní dulce",
                bags: 100,
                ingredients: [
                    { name: "Maní tostado", qty: 930, unit: "g" },
                    { name: "Azúcar", qty: 50, unit: "g" },
                    { name: "Aceite", qty: 20, unit: "g" },
                ],
                params: {
                    densidad: 0.0,
                    premezcladoMin: 10,
                    tempPrecalentamientoC: 65,
                    tiempoPrecalentamientoMin: 10,
                    tiempoMezcladoMin: 18,
                    tempCalentamientoC: 130,
                }
            },
            pasas: {
                name: "Maní con pasas",
                bags: 100,
                ingredients: [
                    { name: "Maní tostado", qty: 820, unit: "g" },
                    { name: "Pasas", qty: 150, unit: "g" },
                    { name: "Sal", qty: 20, unit: "g" },
                    { name: "Aceite", qty: 10, unit: "g" },
                ],
                params: {
                    densidad: 0.0,
                    premezcladoMin: 8,
                    tempPrecalentamientoC: 60,
                    tiempoPrecalentamientoMin: 10,
                    tiempoMezcladoMin: 12,
                    tempCalentamientoC: 110,
                }
            }
        });
    }

    if (!localStorage.getItem(LS.control)) {
        save(LS.control, {
            running: true,
            current: 0,
            updatedAt: Date.now(),
            steps: [
                { id: "sanit", name: "Sanitización zona de producción", status: "pendiente", lastCleanISO: "", intervalHours: 8 },
                { id: "clean", name: "Limpiado y filtrado del maní", status: "pendiente", startedAt: null, endedAt: null, qcApproved: null },
                { id: "descas", name: "Descascarillado", status: "pendiente", startedAt: null, endedAt: null },
                { id: "presec", name: "Pre-secado", status: "pendiente", startedAt: null, endedAt: null, humidity: 12 },
                { id: "toast", name: "Tostado", status: "pendiente", startedAt: null, endedAt: null, ovenTemp: 170 },
                { id: "prep", name: "Preparación correspondiente (Salado/Dulce)", status: "pendiente", startedAt: null, endedAt: null, qcApproved: null },
                { id: "cool", name: "Enfriado", status: "pendiente", startedAt: null, endedAt: null, temp: 30 },
                { id: "pack", name: "Empaquetado", status: "pendiente", startedAt: null, endedAt: null, packsOk: 0, packsDiscarded: 0, qcApproved: null },
            ]
        });
    }
}

/* =========================
   Login handlers (Firebase) - igual flujo
   ========================= */
const REMEMBER_KEY = "lcm_remember_email";

function initLoginHandlers() {
    const loginForm = $("loginForm");
    const username = $("username");
    const password = $("password");
    const rememberMe = $("rememberMe");
    const usernameError = $("usernameError");
    const passwordError = $("passwordError");
    const togglePassword = $("togglePassword");
    const forgotPassword = $("forgotPassword");
    const goRegister = $("goRegister");
    const btnLogin = $("btnLogin");
    const toastLogin = $("toastLogin");

    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) {
        username.value = remembered;
        rememberMe.checked = true;
    }

    togglePassword?.addEventListener("click", () => {
        const hidden = password.type === "password";
        password.type = hidden ? "text" : "password";
        togglePassword.textContent = hidden ? "🙈" : "👁";
    });

    forgotPassword?.addEventListener("click", async (e) => {
        e.preventDefault();
        resetToast(toastLogin);
        const email = username.value.trim();
        if (!isValidEmail(email)) {
            setToast(toastLogin, "Escribe tu correo para enviarte el enlace.", "error");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setToast(toastLogin, "Revisa tu correo para restablecer la contraseña.", "ok");
        } catch (err) {
            console.error(err);
            setToast(toastLogin, "No se pudo enviar el correo.", "error");
        }
    });

    goRegister?.addEventListener("click", (e) => {
        e.preventDefault();
        setToast(toastLogin, "Registro deshabilitado. Pide al admin que cree tu usuario.", "error");
    });

    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        resetToast(toastLogin);
        usernameError.textContent = "";
        passwordError.textContent = "";

        const email = username.value.trim();
        const pass = password.value;

        let ok = true;
        if (!email || !isValidEmail(email)) {
            usernameError.textContent = "Ingresa un correo válido.";
            ok = false;
        }
        if (!pass || pass.length < 6) {
            passwordError.textContent = "Contraseña mínima 6 caracteres.";
            ok = false;
        }
        if (!ok) return;

        btnLogin.disabled = true;
        btnLogin.textContent = "VALIDANDO...";

        try {
            await setPersistence(auth, rememberMe.checked ? browserLocalPersistence : browserSessionPersistence);

            const cred = await signInWithEmailAndPassword(auth, email, pass);

            if (rememberMe.checked) localStorage.setItem(REMEMBER_KEY, email);
            else localStorage.removeItem(REMEMBER_KEY);

            const profile = await loadProfile(cred.user.uid);
            if (!profile) {
                setToast(toastLogin, "Falta perfil en Firestore: users/{UID}.", "error");
                await signOut(auth);
                return;
            }
            if (profile.active === false) {
                setToast(toastLogin, "Usuario desactivado.", "error");
                await signOut(auth);
                return;
            }

            goApp("#inicio");
        } catch (err) {
            console.error(err);
            setToast(toastLogin, "Error al iniciar sesión. Revisa credenciales.", "error");
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = "INICIAR SESIÓN";
        }
    });
}

/* =========================
   APP init
   ========================= */
let controlTimer = null;
let currentProfile = null;
let currentUser = null;

function initApp(profile, user) {
    migrateIfNeeded();
    seedIfNeeded();

    currentProfile = profile;
    currentUser = user;

    $("loginView")?.remove();
    $("appView").hidden = false;

    // Topbar user info
    const name = profile.name || "Usuario";
    const role = String(profile.role || "—").toUpperCase();
    $("uiName").textContent = name;
    $("uiRole2").textContent = role;

    const initials = name.split(" ").slice(0, 2).map(s => (s[0] || "").toUpperCase()).join("") || "LC";
    $("uiAvatar").textContent = initials;

    // Sidebar collapse button (works always)
    $("btnSidebar").addEventListener("click", () => {
        document.body.classList.toggle("sidebar-collapsed");
    });

    // Logout
    $("btnLogout").addEventListener("click", async () => {
        try {
            await signOut(auth);
            goLogin();
        } catch (err) {
            console.error(err);
            setToast($("toastApp"), "No se pudo cerrar sesión.", "error");
        }
    });

    // Menu navigation
    const subERP = $("sub-erp");
    const subMES = $("sub-mes");

    function toggleSub(which) {
        if (which === "erp") subERP.classList.toggle("open");
        if (which === "mes") subMES.classList.toggle("open");
    }

    $("menu").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const toggle = btn.dataset.toggle;
        const view = btn.dataset.view;

        if (toggle) { toggleSub(toggle); return; }
        if (view) { setActive(view); render(view); }
    });

    setActive("inicio");
    render("inicio");
}

/* =========================
   Navigation helpers
   ========================= */
function setActive(view) {
    document.querySelectorAll(".mitem,.sitem").forEach(b => b.classList.remove("is-active"));
    document.querySelector(`[data-view="${view}"]`)?.classList.add("is-active");

    if (view.startsWith("erp-")) {
        document.querySelector(`[data-toggle="erp"]`)?.classList.add("is-active");
        $("sub-erp")?.classList.add("open");
    }
    if (view.startsWith("mes-")) {
        document.querySelector(`[data-toggle="mes"]`)?.classList.add("is-active");
        $("sub-mes")?.classList.add("open");
    }
}

/* =========================
   Renders
   ========================= */
function render(view) {
    resetToast($("toastApp"));

    const root = $("viewRoot");
    if (!root) return;

    if (view === "inicio") {
        root.innerHTML = `
      <div class="card">
        <p class="kicker">Bienvenidos a</p>
        <h2 class="h1">La Casa del Maní</h2>
        <p class="muted">Usuario autenticado:</p>

        <div class="grid2" style="margin-top:12px">
          <div class="card" style="box-shadow:none">
            <b>Correo</b>
            <div class="muted">${escapeHtml(currentUser?.email || "—")}</div>
          </div>
          <div class="card" style="box-shadow:none">
            <b>Rol</b>
            <div class="muted">${escapeHtml(String(currentProfile?.role || "—").toUpperCase())}</div>
          </div>
        </div>

        <div style="margin-top:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <img src="imagen/LOGO.png" alt="Logo" style="width:160px;height:160px;object-fit:contain;border:1px solid rgba(17,24,39,.08);border-radius:18px;padding:10px"
               onerror="this.style.display='none'">
          <div class="muted" style="max-width:520px">
            Zona principal: bienvenida, información del usuario y logo grande.
          </div>
        </div>
      </div>
    `;
        return;
    }

    if (view === "erp-inventario") { renderInventario(root); return; }
    if (view === "erp-mp") { renderMateriaPrima(root); return; }
    if (view === "erp-param") { renderParametros(root); return; }
    if (view === "erp-pedido") { renderPedido(root); return; }

    if (view === "mes-op") { renderMES(root, "all"); return; }
    if (view === "mes-aprobada") { renderMES(root, "en_produccion"); return; }
    if (view === "mes-terminada") { renderMES(root, "terminada"); return; }

    if (view === "control") { renderControl(root); return; }

    root.innerHTML = `<div class="card"><p class="muted">Vista no implementada.</p></div>`;
}

/* =========================
   (3) Inventario: add + edit + delta
   ========================= */
function getInv() { return load(LS.inventory, []); }
function setInv(arr) { save(LS.inventory, arr); }

function renderInventario(root) {
    const inv = getInv();

    root.innerHTML = `
    <div class="card">
      <p class="kicker">ERP</p>
      <h2 class="h1">Inventario</h2>
      <p class="muted">Agregar productos, editar cantidades/capacidad, y ajustar con Δ (+/-).</p>

      <div class="card" style="box-shadow:none;margin-top:12px">
        <h3 style="margin:0 0 10px">Agregar producto nuevo</h3>
        <div class="grid3">
          <div>
            <div style="font-weight:800;font-size:12px;margin-bottom:6px">Nombre</div>
            <input class="input" id="invNewName" placeholder="Ej: Maní picante">
          </div>
          <div>
            <div style="font-weight:800;font-size:12px;margin-bottom:6px">Cantidad inicial</div>
            <input class="input" id="invNewQty" type="number" step="1" min="0" placeholder="0">
          </div>
          <div>
            <div style="font-weight:800;font-size:12px;margin-bottom:6px">Capacidad</div>
            <input class="input" id="invNewCap" type="number" step="1" min="0" placeholder="500">
          </div>
        </div>
        <div class="actions" style="margin-top:10px">
          <button class="smallbtn orange" id="btnInvAdd">Agregar</button>
        </div>
      </div>

      <div style="margin-top:12px;overflow:auto">
        <table class="table">
          <thead>
            <tr>
              <th style="min-width:220px">Producto</th>
              <th style="min-width:130px">Cantidad</th>
              <th style="min-width:130px">Capacidad</th>
              <th style="min-width:140px">Δ Ajuste</th>
              <th style="min-width:230px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${inv.map(p => `
              <tr>
                <td><input class="input" data-inv-name="${p.id}" value="${escapeHtml(p.name)}"></td>
                <td><input class="input" type="number" step="1" data-inv-qty="${p.id}" value="${Number(p.qty)}"></td>
                <td><input class="input" type="number" step="1" data-inv-cap="${p.id}" value="${Number(p.capacity)}"></td>
                <td><input class="input" type="number" step="1" data-inv-delta="${p.id}" value="0"></td>
                <td class="actions">
                  <button class="smallbtn" data-inv-apply="${p.id}">Aplicar Δ</button>
                  <button class="smallbtn orange" data-inv-save="${p.id}">Guardar</button>
                  <button class="smallbtn danger" data-inv-del="${p.id}">Eliminar</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

    // Add new
    root.querySelector("#btnInvAdd").addEventListener("click", () => {
        const name = (root.querySelector("#invNewName").value || "").trim();
        const qty = Number(root.querySelector("#invNewQty").value || 0);
        const cap = Number(root.querySelector("#invNewCap").value || 0);

        if (!name) { alert("Escribe el nombre del producto."); return; }
        if (!Number.isFinite(qty) || qty < 0) { alert("Cantidad inválida."); return; }
        if (!Number.isFinite(cap) || cap <= 0) { alert("Capacidad inválida."); return; }
        if (qty > cap) { alert("La cantidad no puede superar la capacidad."); return; }

        const inv2 = getInv();
        if (inv2.some(x => x.name.toLowerCase() === name.toLowerCase())) {
            alert("Ese producto ya existe.");
            return;
        }

        inv2.push({ id: uid(), name, qty, capacity: cap });
        setInv(inv2);
        renderInventario(root);
    });

    // Apply delta
    root.querySelectorAll("[data-inv-apply]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.invApply;
            const inv2 = getInv();
            const item = inv2.find(x => x.id === id);
            if (!item) return;

            const delta = Number(root.querySelector(`[data-inv-delta="${id}"]`).value || 0);
            if (!Number.isFinite(delta) || delta === 0) { alert("Δ debe ser un número distinto de 0."); return; }

            const newQty = Number(item.qty) + delta;
            if (newQty < 0) { alert("No puedes dejar cantidad negativa."); return; }
            if (newQty > Number(item.capacity)) { alert("No puedes superar la capacidad."); return; }

            item.qty = newQty;
            setInv(inv2);
            renderInventario(root);
        });
    });

    // Save row
    root.querySelectorAll("[data-inv-save]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.invSave;
            const inv2 = getInv();
            const item = inv2.find(x => x.id === id);
            if (!item) return;

            const name = (root.querySelector(`[data-inv-name="${id}"]`).value || "").trim();
            const qty = Number(root.querySelector(`[data-inv-qty="${id}"]`).value || 0);
            const cap = Number(root.querySelector(`[data-inv-cap="${id}"]`).value || 0);

            if (!name) { alert("Nombre inválido."); return; }
            if (!Number.isFinite(qty) || qty < 0) { alert("Cantidad inválida."); return; }
            if (!Number.isFinite(cap) || cap <= 0) { alert("Capacidad inválida."); return; }
            if (qty > cap) { alert("Cantidad no puede superar capacidad."); return; }

            // unique name
            if (inv2.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) {
                alert("Ya existe otro producto con ese nombre.");
                return;
            }

            item.name = name;
            item.qty = qty;
            item.capacity = cap;
            setInv(inv2);
            setToast($("toastApp"), "Producto actualizado.", "ok");
            renderInventario(root);
        });
    });

    // Delete row
    root.querySelectorAll("[data-inv-del]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.invDel;
            if (!confirm("¿Eliminar este producto?")) return;
            const inv2 = getInv().filter(x => x.id !== id);
            setInv(inv2);
            renderInventario(root);
        });
    });
}

/* =========================
   (4) Materia prima: qty + capacity tanque + edit + delta
   ========================= */
function getRaw() { return load(LS.raw, []); }
function setRaw(arr) { save(LS.raw, arr); }

function renderMateriaPrima(root) {
    const raws = getRaw();

    root.innerHTML = `
    <div class="card">
      <p class="kicker">ERP</p>
      <h2 class="h1">Materia Prima</h2>
      <p class="muted">Agregar/editar/borrar, con cantidad existente y capacidad del tanque (editable con Δ).</p>

      <div class="card" style="box-shadow:none;margin-top:12px">
        <h3 style="margin:0 0 10px">Agregar materia prima</h3>
        <div class="grid3">
          <div>
            <div style="font-weight:800;font-size:12px;margin-bottom:6px">Nombre</div>
            <input class="input" id="rawNewName" placeholder="Ej: Sal fina">
          </div>
          <div>
            <div style="font-weight:800;font-size:12px;margin-bottom:6px">Cantidad existente</div>
            <input class="input" id="rawNewQty" type="number" step="0.01" min="0" placeholder="0">
          </div>
          <div>
            <div style="font-weight:800;font-size:12px;margin-bottom:6px">Capacidad tanque</div>
            <input class="input" id="rawNewCap" type="number" step="0.01" min="0" placeholder="100">
          </div>
        </div>
        <div class="actions" style="margin-top:10px">
          <button class="smallbtn orange" id="btnRawAdd">Agregar</button>
        </div>
      </div>

      <div style="margin-top:12px;overflow:auto">
        <table class="table">
          <thead>
            <tr>
              <th style="min-width:220px">Materia Prima</th>
              <th style="min-width:140px">Cantidad</th>
              <th style="min-width:140px">Capacidad</th>
              <th style="min-width:140px">Δ Ajuste</th>
              <th style="min-width:230px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${raws.map(r => `
              <tr>
                <td><input class="input" data-raw-name="${r.id}" value="${escapeHtml(r.name)}"></td>
                <td><input class="input" type="number" step="0.01" data-raw-qty="${r.id}" value="${Number(r.qty)}"></td>
                <td><input class="input" type="number" step="0.01" data-raw-cap="${r.id}" value="${Number(r.capacity)}"></td>
                <td><input class="input" type="number" step="0.01" data-raw-delta="${r.id}" value="0"></td>
                <td class="actions">
                  <button class="smallbtn" data-raw-apply="${r.id}">Aplicar Δ</button>
                  <button class="smallbtn orange" data-raw-save="${r.id}">Guardar</button>
                  <button class="smallbtn danger" data-raw-del="${r.id}">Eliminar</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

    // Add
    root.querySelector("#btnRawAdd").addEventListener("click", () => {
        const name = (root.querySelector("#rawNewName").value || "").trim();
        const qty = Number(root.querySelector("#rawNewQty").value || 0);
        const cap = Number(root.querySelector("#rawNewCap").value || 0);

        if (!name) { alert("Escribe el nombre."); return; }
        if (!Number.isFinite(qty) || qty < 0) { alert("Cantidad inválida."); return; }
        if (!Number.isFinite(cap) || cap <= 0) { alert("Capacidad inválida."); return; }
        if (qty > cap) { alert("Cantidad no puede superar capacidad."); return; }

        const raw2 = getRaw();
        if (raw2.some(x => x.name.toLowerCase() === name.toLowerCase())) {
            alert("Esa materia prima ya existe.");
            return;
        }

        raw2.push({ id: uid(), name, qty, capacity: cap, unit: "" });
        setRaw(raw2);
        renderMateriaPrima(root);
    });

    // Apply delta
    root.querySelectorAll("[data-raw-apply]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.rawApply;
            const raw2 = getRaw();
            const item = raw2.find(x => x.id === id);
            if (!item) return;

            const delta = Number(root.querySelector(`[data-raw-delta="${id}"]`).value || 0);
            if (!Number.isFinite(delta) || delta === 0) { alert("Δ debe ser distinto de 0."); return; }

            const newQty = Number(item.qty) + delta;
            if (newQty < 0) { alert("No puedes dejar cantidad negativa."); return; }
            if (newQty > Number(item.capacity)) { alert("No puedes superar capacidad."); return; }

            item.qty = newQty;
            setRaw(raw2);
            renderMateriaPrima(root);
        });
    });

    // Save
    root.querySelectorAll("[data-raw-save]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.rawSave;
            const raw2 = getRaw();
            const item = raw2.find(x => x.id === id);
            if (!item) return;

            const name = (root.querySelector(`[data-raw-name="${id}"]`).value || "").trim();
            const qty = Number(root.querySelector(`[data-raw-qty="${id}"]`).value || 0);
            const cap = Number(root.querySelector(`[data-raw-cap="${id}"]`).value || 0);

            if (!name) { alert("Nombre inválido."); return; }
            if (!Number.isFinite(qty) || qty < 0) { alert("Cantidad inválida."); return; }
            if (!Number.isFinite(cap) || cap <= 0) { alert("Capacidad inválida."); return; }
            if (qty > cap) { alert("Cantidad no puede superar capacidad."); return; }

            if (raw2.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) {
                alert("Ya existe otra materia prima con ese nombre.");
                return;
            }

            item.name = name;
            item.qty = qty;
            item.capacity = cap;
            setRaw(raw2);

            setToast($("toastApp"), "Materia prima actualizada.", "ok");
            renderMateriaPrima(root);
        });
    });

    // Delete
    root.querySelectorAll("[data-raw-del]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.rawDel;
            if (!confirm("¿Eliminar esta materia prima?")) return;
            const raw2 = getRaw().filter(x => x.id !== id);
            setRaw(raw2);
            renderMateriaPrima(root);
        });
    });
}

/* =========================
   (5) Parámetros de referencia (recetas 100 bolsas)
   ========================= */
function getRecipes() { return load(LS.recipes, {}); }
function setRecipes(obj) { save(LS.recipes, obj); }

function renderParametros(root) {
    const recipes = getRecipes();
    const rawNames = getRaw().map(r => r.name);

    root.innerHTML = `
    <div class="card">
      <p class="kicker">ERP</p>
      <h2 class="h1">Parámetros de referencia</h2>
      <p class="muted">Recetas por cada <b>100 bolsas</b> para maní salado, dulce y con pasas. Edita ingredientes y parámetros.</p>

      ${["salado", "dulce", "pasas"].map(key => renderRecipeCard(key, recipes[key], rawNames)).join("")}
    </div>
  `;

    // handlers generales (delegación)
    root.querySelectorAll("[data-recipe-save]").forEach(btn => {
        btn.addEventListener("click", () => {
            const k = btn.dataset.recipeSave;
            const rec = readRecipeFromUI(root, k);
            const all = getRecipes();
            all[k] = rec;
            setRecipes(all);
            setToast($("toastApp"), `Guardado: ${rec.name}`, "ok");
            renderParametros(root);
        });
    });

    root.querySelectorAll("[data-ingredient-add]").forEach(btn => {
        btn.addEventListener("click", () => {
            const k = btn.dataset.ingredientAdd;
            const all = getRecipes();
            all[k].ingredients.push({ name: "", qty: 0, unit: "g" });
            setRecipes(all);
            renderParametros(root);
        });
    });

    root.querySelectorAll("[data-ingredient-del]").forEach(btn => {
        btn.addEventListener("click", () => {
            const k = btn.dataset.recipe;
            const idx = Number(btn.dataset.ingredientDel);
            const all = getRecipes();
            all[k].ingredients.splice(idx, 1);
            setRecipes(all);
            renderParametros(root);
        });
    });
}

function renderRecipeCard(key, rec, rawNames) {
    const title = rec?.name || key;
    const bags = rec?.bags ?? 100;
    const ingredients = Array.isArray(rec?.ingredients) ? rec.ingredients : [];
    const p = rec?.params || {};

    // datalist para autocompletar ingredientes
    const dlId = `dl_${key}`;

    return `
    <div class="card" style="box-shadow:none;margin-top:12px">
      <div class="actions" style="justify-content:space-between">
        <div>
          <h3 style="margin:0">${escapeHtml(title)}</h3>
          <div class="muted">Base: <b>${bags}</b> bolsas (editable)</div>
        </div>
        <button class="smallbtn orange" data-recipe-save="${key}">Guardar receta</button>
      </div>

      <div class="grid2" style="margin-top:12px">
        <div>
          <div style="font-weight:900;margin-bottom:8px">Ingredientes (por ${bags} bolsas)</div>

          <datalist id="${dlId}">
            ${rawNames.map(n => `<option value="${escapeHtml(n)}"></option>`).join("")}
          </datalist>

          <div style="overflow:auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th style="width:140px">Cantidad</th>
                  <th style="width:120px">Unidad</th>
                  <th style="width:120px"></th>
                </tr>
              </thead>
              <tbody>
                ${ingredients.map((it, idx) => `
                  <tr>
                    <td>
                      <input class="input" list="${dlId}" data-rec="${key}" data-ing-name="${idx}" value="${escapeHtml(it.name)}" placeholder="Ej: Maní tostado">
                    </td>
                    <td>
                      <input class="input" type="number" step="0.01" data-rec="${key}" data-ing-qty="${idx}" value="${Number(it.qty)}">
                    </td>
                    <td>
                      <select data-rec="${key}" data-ing-unit="${idx}">
                        ${["g", "kg", "ml", "L", "%"].map(u => `<option value="${u}" ${u === it.unit ? "selected" : ""}>${u}</option>`).join("")}
                      </select>
                    </td>
                    <td>
                      <button class="smallbtn danger" data-recipe="${key}" data-ingredient-del="${idx}">Quitar</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <div class="actions" style="margin-top:10px">
            <button class="smallbtn" data-ingredient-add="${key}">Agregar ingrediente</button>
          </div>
        </div>

        <div>
          <div style="font-weight:900;margin-bottom:8px">Parámetros (editable)</div>
          <div class="grid2">
            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Bolsas base</div>
              <input class="input" type="number" step="1" min="1" data-rec="${key}" data-rec-bags value="${Number(bags)}">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Densidad</div>
              <input class="input" type="number" step="0.000001" data-rec="${key}" data-p="densidad" value="${Number(p.densidad ?? 0)}">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Tiempo premezclado (min)</div>
              <input class="input" type="number" step="1" data-rec="${key}" data-p="premezcladoMin" value="${Number(p.premezcladoMin ?? 0)}">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Temp precalentamiento (°C)</div>
              <input class="input" type="number" step="1" data-rec="${key}" data-p="tempPrecalentamientoC" value="${Number(p.tempPrecalentamientoC ?? 0)}">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Tiempo precalentamiento (min)</div>
              <input class="input" type="number" step="1" data-rec="${key}" data-p="tiempoPrecalentamientoMin" value="${Number(p.tiempoPrecalentamientoMin ?? 0)}">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Tiempo mezclado (min)</div>
              <input class="input" type="number" step="1" data-rec="${key}" data-p="tiempoMezcladoMin" value="${Number(p.tiempoMezcladoMin ?? 0)}">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Temp calentamiento (°C)</div>
              <input class="input" type="number" step="1" data-rec="${key}" data-p="tempCalentamientoC" value="${Number(p.tempCalentamientoC ?? 0)}">
            </label>
          </div>

          <p class="muted" style="margin-top:10px">
            Tip: puedes autocompletar ingredientes con los nombres de Materia Prima.
          </p>
        </div>
      </div>
    </div>
  `;
}

function readRecipeFromUI(root, key) {
    const all = getRecipes();
    const base = all[key];

    const bags = Number(root.querySelector(`[data-rec="${key}"][data-rec-bags]`).value || 100);

    const ingredients = base.ingredients.map((_, idx) => {
        const name = (root.querySelector(`[data-rec="${key}"][data-ing-name="${idx}"]`).value || "").trim();
        const qty = Number(root.querySelector(`[data-rec="${key}"][data-ing-qty="${idx}"]`).value || 0);
        const unit = root.querySelector(`[data-rec="${key}"][data-ing-unit="${idx}"]`).value || "g";
        return { name, qty, unit };
    });

    const params = {};
    ["densidad", "premezcladoMin", "tempPrecalentamientoC", "tiempoPrecalentamientoMin", "tiempoMezcladoMin", "tempCalentamientoC"]
        .forEach(p => {
            params[p] = Number(root.querySelector(`[data-rec="${key}"][data-p="${p}"]`).value || 0);
        });

    return {
        ...base,
        bags,
        ingredients,
        params
    };
}

/* =========================
   Pedido (simple, como antes)
   ========================= */
function renderPedido(root) {
    const orders = load(LS.orders, []);

    root.innerHTML = `
    <div class="card">
      <p class="kicker">ERP</p>
      <h2 class="h1">Orden de Pedido</h2>
      <p class="muted">Registra pedidos y genera Órdenes de Producción (MES).</p>

      <div class="grid2" style="margin-top:12px">
        <div class="card" style="box-shadow:none">
          <h3 style="margin:0 0 10px">Registrar pedido</h3>

          <div style="display:grid;gap:10px">
            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Cliente</div>
              <input class="input" id="p_cliente" placeholder="Ej: Juan Pérez">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Prioridad</div>
              <select id="p_prioridad">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Referencia</div>
              <input class="input" id="p_ref" placeholder="REF-0001">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Producto</div>
              <input class="input" id="p_prod" placeholder="Maní salado">
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Presentación</div>
              <select id="p_pres">
                <option value="grande">Grande</option>
                <option value="pequeño">Pequeño</option>
              </select>
            </label>

            <label>
              <div style="font-weight:800;font-size:12px;margin-bottom:6px">Cantidad</div>
              <input class="input" id="p_qty" type="number" min="1" placeholder="1">
            </label>

            <div class="actions">
              <button class="smallbtn orange" id="btnCrearPedido">Crear pedido</button>
            </div>
          </div>
        </div>

        <div class="card" style="box-shadow:none">
          <h3 style="margin:0 0 10px">Pedidos</h3>
          <div style="overflow:auto">
            <table class="table">
              <thead>
                <tr><th>Ref</th><th>Cliente</th><th>Prioridad</th><th>Producto</th><th>Pres.</th><th>Cant.</th></tr>
              </thead>
              <tbody>
                ${orders.length ? orders.map(o => `
                  <tr>
                    <td><b>${escapeHtml(o.ref)}</b></td>
                    <td>${escapeHtml(o.cliente)}</td>
                    <td>${escapeHtml(o.prioridad.toUpperCase())}</td>
                    <td>${escapeHtml(o.producto)}</td>
                    <td>${escapeHtml(o.presentacion)}</td>
                    <td>${o.cantidad}</td>
                  </tr>
                `).join("") : `<tr><td colspan="6" class="muted">No hay pedidos.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

    root.querySelector("#btnCrearPedido").addEventListener("click", () => {
        const cliente = (root.querySelector("#p_cliente").value || "").trim();
        const prioridad = root.querySelector("#p_prioridad").value;
        const ref = (root.querySelector("#p_ref").value || "").trim();
        const producto = (root.querySelector("#p_prod").value || "").trim();
        const presentacion = root.querySelector("#p_pres").value;
        const cantidad = Number(root.querySelector("#p_qty").value || 0);

        if (!cliente || !ref || !producto || !Number.isFinite(cantidad) || cantidad <= 0) {
            alert("Completa cliente, referencia, producto y cantidad.");
            return;
        }

        const orders2 = load(LS.orders, []);
        const id = uid();
        orders2.unshift({ id, cliente, prioridad, ref, producto, presentacion, cantidad, createdAt: Date.now() });
        save(LS.orders, orders2);

        const prod = load(LS.prod, []);
        prod.unshift({
            id: "OP-" + ref,
            orderId: id,
            ref, cliente, producto, presentacion, cantidad,
            estado: "pendiente",
            observaciones: "",
            detalles: "",
            createdAt: Date.now(),
        });
        save(LS.prod, prod);

        renderPedido(root);
    });
}

/* =========================
   MES (igual)
   ========================= */
function renderMES(root, filter) {
    const prod = load(LS.prod, []);
    const rows = prod.filter(p => (filter === "all" ? true : p.estado === filter));

    const title = filter === "all" ? "Orden de Producción"
        : filter === "en_produccion" ? "Orden Producción Aprobada"
            : "Orden Producción Terminada";

    root.innerHTML = `
    <div class="card">
      <p class="kicker">MES</p>
      <h2 class="h1">${title}</h2>
      <p class="muted">Gestión de estado, observaciones y detalles.</p>

      <div style="margin-top:12px;overflow:auto">
        <table class="table">
          <thead>
            <tr>
              <th>OP</th><th>Ref</th><th>Cliente</th><th>Producto</th><th>Pres.</th><th>Cant.</th>
              <th>Estado</th><th>Observaciones</th><th>Detalles</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(p => `
              <tr>
                <td><b>${escapeHtml(p.id)}</b></td>
                <td>${escapeHtml(p.ref)}</td>
                <td>${escapeHtml(p.cliente)}</td>
                <td>${escapeHtml(p.producto)}</td>
                <td>${escapeHtml(p.presentacion)}</td>
                <td>${p.cantidad}</td>
                <td>
                  <select data-st="${escapeHtml(p.id)}">
                    <option value="pendiente" ${p.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="en_produccion" ${p.estado === "en_produccion" ? "selected" : ""}>En producción</option>
                    <option value="terminada" ${p.estado === "terminada" ? "selected" : ""}>Terminada</option>
                  </select>
                </td>
                <td style="min-width:220px"><input class="input" data-obs="${escapeHtml(p.id)}" value="${escapeHtml(p.observaciones || "")}" placeholder="—"></td>
                <td style="min-width:220px"><input class="input" data-det="${escapeHtml(p.id)}" value="${escapeHtml(p.detalles || "")}" placeholder="—"></td>
                <td class="actions" style="min-width:220px">
                  <button class="smallbtn orange" data-save="${escapeHtml(p.id)}">Guardar</button>
                  <button class="smallbtn" data-apr="${escapeHtml(p.id)}">Aprobar</button>
                  <button class="smallbtn" data-fin="${escapeHtml(p.id)}">Terminar</button>
                </td>
              </tr>
            `).join("")
            : `<tr><td colspan="10" class="muted">No hay órdenes.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

    function updateProd(id, patch) {
        const prod2 = load(LS.prod, []);
        const x = prod2.find(a => a.id === id);
        if (!x) return;
        Object.assign(x, patch);
        save(LS.prod, prod2);
    }

    root.querySelectorAll("[data-save]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.save;
            const estado = root.querySelector(`[data-st="${id}"]`).value;
            const obs = root.querySelector(`[data-obs="${id}"]`).value;
            const det = root.querySelector(`[data-det="${id}"]`).value;
            updateProd(id, { estado, observaciones: obs, detalles: det });
            setToast($("toastApp"), "Cambios guardados.", "ok");
            renderMES(root, filter);
        });
    });
    root.querySelectorAll("[data-apr]").forEach(btn => {
        btn.addEventListener("click", () => {
            updateProd(btn.dataset.apr, { estado: "en_produccion" });
            renderMES(root, filter);
        });
    });
    root.querySelectorAll("[data-fin]").forEach(btn => {
        btn.addEventListener("click", () => {
            updateProd(btn.dataset.fin, { estado: "terminada" });
            renderMES(root, filter);
        });
    });
}

/* =========================
   (6) Sistema de Control (orden + detalles)
   ========================= */
function getControl() { return load(LS.control, null); }
function setControl(v) { save(LS.control, v); }

function statusBadge(status) {
    if (status === "finalizado") return `<span class="badge ok">● Finalizado</span>`;
    if (status === "en_proceso") return `<span class="badge warn">● En proceso</span>`;
    return `<span class="badge gray">● Pendiente</span>`;
}

function renderControl(root) {
    const st = getControl();
    if (!st) { root.innerHTML = `<div class="card">Sin estado de control.</div>`; return; }

    const now = new Date();
    const updated = new Date(st.updatedAt || Date.now()).toLocaleString();

    root.innerHTML = `
    <div class="card">
      <p class="kicker">Sistemas de Control</p>
      <h2 class="h1">Proceso de Producción</h2>
      <p class="muted">Orden y estados según flujo. Última actualización: ${escapeHtml(updated)}</p>

      <div class="actions" style="margin-top:12px">
        <button class="smallbtn orange" id="ctlToggle">${st.running ? "Pausar" : "Continuar"}</button>
        <button class="smallbtn" id="ctlNext">Siguiente paso</button>
        <button class="smallbtn danger" id="ctlReset">Reiniciar</button>
      </div>

      <div class="flowGrid" style="margin-top:12px">
        ${st.steps.map((s, idx) => renderStepCard(s, idx, st.current)).join("")}
      </div>
    </div>
  `;

    // Global controls
    root.querySelector("#ctlToggle").addEventListener("click", () => {
        const cur = getControl();
        cur.running = !cur.running;
        cur.updatedAt = Date.now();
        setControl(cur);
        syncControlTimer();
        renderControl(root);
    });

    root.querySelector("#ctlNext").addEventListener("click", () => {
        advanceControlStepManual();
        renderControl(root);
    });

    root.querySelector("#ctlReset").addEventListener("click", () => {
        if (!confirm("¿Reiniciar todo el proceso?")) return;
        const cur = getControl();
        cur.running = true;
        cur.current = 0;
        cur.updatedAt = Date.now();
        cur.steps = cur.steps.map(s => ({
            ...s,
            status: "pendiente",
            startedAt: null,
            endedAt: null,
            qcApproved: (s.qcApproved !== undefined) ? null : s.qcApproved,
            packsOk: (s.packsOk !== undefined) ? 0 : s.packsOk,
            packsDiscarded: (s.packsDiscarded !== undefined) ? 0 : s.packsDiscarded,
        }));
        setControl(cur);
        syncControlTimer();
        renderControl(root);
    });

    // Per-step listeners
    root.querySelectorAll("[data-step-status]").forEach(sel => {
        sel.addEventListener("change", () => {
            const idx = Number(sel.dataset.stepStatus);
            const cur = getControl();
            cur.steps[idx].status = sel.value;
            if (sel.value === "en_proceso" && !cur.steps[idx].startedAt) cur.steps[idx].startedAt = Date.now();
            if (sel.value === "finalizado" && !cur.steps[idx].endedAt) cur.steps[idx].endedAt = Date.now();
            cur.updatedAt = Date.now();
            setControl(cur);
            renderControl(root);
        });
    });

    // Sanitization
    root.querySelectorAll("[data-sanit-now]").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.sanitNow);
            const cur = getControl();
            cur.steps[idx].lastCleanISO = new Date().toISOString();
            cur.updatedAt = Date.now();
            setControl(cur);
            renderControl(root);
        });
    });
    root.querySelectorAll("[data-sanit-interval]").forEach(inp => {
        inp.addEventListener("change", () => {
            const idx = Number(inp.dataset.sanitInterval);
            const cur = getControl();
            cur.steps[idx].intervalHours = Number(inp.value || 8);
            cur.updatedAt = Date.now();
            setControl(cur);
            renderControl(root);
        });
    });

    // QC toggles
    root.querySelectorAll("[data-qc]").forEach(sel => {
        sel.addEventListener("change", () => {
            const idx = Number(sel.dataset.qc);
            const cur = getControl();
            const v = sel.value;
            cur.steps[idx].qcApproved = (v === "null" ? null : v === "true");
            cur.updatedAt = Date.now();
            setControl(cur);
            renderControl(root);
        });
    });

    // Numeric fields (humidity/temp/pack counts)
    root.querySelectorAll("[data-num]").forEach(inp => {
        inp.addEventListener("change", () => {
            const idx = Number(inp.dataset.idx);
            const field = inp.dataset.num;
            const cur = getControl();
            cur.steps[idx][field] = Number(inp.value || 0);
            cur.updatedAt = Date.now();
            setControl(cur);
            renderControl(root);
        });
    });
}

function renderStepCard(s, idx, currentIdx) {
    const started = s.startedAt ? new Date(s.startedAt).toLocaleString() : "—";
    const ended = s.endedAt ? new Date(s.endedAt).toLocaleString() : "—";
    const isCurrent = idx === currentIdx;

    // Extra content by step type
    let extra = "";

    if (s.id === "sanit") {
        const last = s.lastCleanISO ? new Date(s.lastCleanISO) : null;
        const intervalH = Number(s.intervalHours || 8);
        let due = true;
        let nextTxt = "—";
        let lastTxt = "—";

        if (last) {
            const next = new Date(last.getTime() + intervalH * 60 * 60 * 1000);
            due = (Date.now() > next.getTime());
            nextTxt = next.toLocaleString();
            lastTxt = last.toLocaleString();
        }

        extra = `
      <div class="stepFields">
        <div>
          <div class="muted">Último aseo</div>
          <div><b>${escapeHtml(lastTxt)}</b></div>
        </div>
        <div>
          <div class="muted">Próximo aseo</div>
          <div><b>${escapeHtml(nextTxt)}</b></div>
        </div>

        <label>
          <div class="muted">Intervalo (horas)</div>
          <input class="input" type="number" min="1" step="1" data-sanit-interval="${idx}" value="${intervalH}">
        </label>

        <div>
          <div class="muted">Estado</div>
          ${due ? `<span class="badge danger">⚠ Aseo requerido</span>` : `<span class="badge ok">OK</span>`}
        </div>
      </div>
      <div class="actions" style="margin-top:10px">
        <button class="smallbtn ok" data-sanit-now="${idx}">Registrar aseo ahora</button>
      </div>
    `;
    }

    if (s.id === "clean") {
        extra = `
      <div class="stepFields">
        <div>
          <div class="muted">Inicio</div>
          <div><b>${escapeHtml(started)}</b></div>
        </div>
        <div>
          <div class="muted">Fin</div>
          <div><b>${escapeHtml(ended)}</b></div>
        </div>
        <label>
          <div class="muted">Prueba de calidad limpieza</div>
          <select data-qc="${idx}">
            <option value="null" ${s.qcApproved === null ? "selected" : ""}>—</option>
            <option value="true" ${s.qcApproved === true ? "selected" : ""}>Aprobado</option>
            <option value="false" ${s.qcApproved === false ? "selected" : ""}>No aprobado</option>
          </select>
        </label>
      </div>
    `;
    }

    if (s.id === "descas") {
        extra = `
      <div class="stepFields">
        <div><div class="muted">Inicio</div><div><b>${escapeHtml(started)}</b></div></div>
        <div><div class="muted">Fin</div><div><b>${escapeHtml(ended)}</b></div></div>
      </div>
    `;
    }

    if (s.id === "presec") {
        extra = `
      <div class="stepFields">
        <div><div class="muted">Inicio</div><div><b>${escapeHtml(started)}</b></div></div>
        <div><div class="muted">Fin</div><div><b>${escapeHtml(ended)}</b></div></div>
        <label>
          <div class="muted">Nivel de humedad (%)</div>
          <input class="input" type="number" step="0.1" data-num="humidity" data-idx="${idx}" value="${Number(s.humidity ?? 0)}">
        </label>
      </div>
    `;
    }

    if (s.id === "toast") {
        extra = `
      <div class="stepFields">
        <div><div class="muted">Inicio</div><div><b>${escapeHtml(started)}</b></div></div>
        <div><div class="muted">Fin</div><div><b>${escapeHtml(ended)}</b></div></div>
        <label>
          <div class="muted">Temperatura horno (°C)</div>
          <input class="input" type="number" step="1" data-num="ovenTemp" data-idx="${idx}" value="${Number(s.ovenTemp ?? 0)}">
        </label>
      </div>
    `;
    }

    if (s.id === "prep") {
        extra = `
      <div class="stepFields">
        <div><div class="muted">Inicio</div><div><b>${escapeHtml(started)}</b></div></div>
        <div><div class="muted">Fin</div><div><b>${escapeHtml(ended)}</b></div></div>
        <label>
          <div class="muted">Prueba de calidad (encargado)</div>
          <select data-qc="${idx}">
            <option value="null" ${s.qcApproved === null ? "selected" : ""}>—</option>
            <option value="true" ${s.qcApproved === true ? "selected" : ""}>Aprobado</option>
            <option value="false" ${s.qcApproved === false ? "selected" : ""}>No aprobado</option>
          </select>
        </label>
      </div>
    `;
    }

    if (s.id === "cool") {
        extra = `
      <div class="stepFields">
        <div><div class="muted">Inicio</div><div><b>${escapeHtml(started)}</b></div></div>
        <div><div class="muted">Fin</div><div><b>${escapeHtml(ended)}</b></div></div>
        <label>
          <div class="muted">Temperatura (°C)</div>
          <input class="input" type="number" step="0.1" data-num="temp" data-idx="${idx}" value="${Number(s.temp ?? 0)}">
        </label>
      </div>
    `;
    }

    if (s.id === "pack") {
        extra = `
      <div class="stepFields">
        <div><div class="muted">Inicio</div><div><b>${escapeHtml(started)}</b></div></div>
        <div><div class="muted">Fin</div><div><b>${escapeHtml(ended)}</b></div></div>

        <label>
          <div class="muted">Paquetes OK</div>
          <input class="input" type="number" step="1" min="0" data-num="packsOk" data-idx="${idx}" value="${Number(s.packsOk ?? 0)}">
        </label>

        <label>
          <div class="muted">Descartadas por error</div>
          <input class="input" type="number" step="1" min="0" data-num="packsDiscarded" data-idx="${idx}" value="${Number(s.packsDiscarded ?? 0)}">
        </label>

        <label>
          <div class="muted">Prueba de calidad (encargado)</div>
          <select data-qc="${idx}">
            <option value="null" ${s.qcApproved === null ? "selected" : ""}>—</option>
            <option value="true" ${s.qcApproved === true ? "selected" : ""}>Aprobado</option>
            <option value="false" ${s.qcApproved === false ? "selected" : ""}>No aprobado</option>
          </select>
        </label>
      </div>
    `;
    }

    const statusSelect = `
    <select data-step-status="${idx}">
      <option value="pendiente" ${s.status === "pendiente" ? "selected" : ""}>Pendiente</option>
      <option value="en_proceso" ${s.status === "en_proceso" ? "selected" : ""}>En proceso</option>
      <option value="finalizado" ${s.status === "finalizado" ? "selected" : ""}>Finalizado</option>
    </select>
  `;

    return `
    <div class="stepCard">
      <div class="stepTop">
        <div>
          <p class="stepTitle">${idx + 1}. ${escapeHtml(s.name)}</p>
          <div class="stepMeta">${isCurrent ? "<b>Actual</b>" : "—"}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          ${statusBadge(s.status)}
          ${statusSelect}
        </div>
      </div>
      ${extra}
    </div>
  `;
}

function advanceControlStepManual() {
    const cur = getControl();
    const i = cur.current;
    const step = cur.steps[i];
    if (!step) return;

    if (step.status === "pendiente") {
        step.status = "en_proceso";
        step.startedAt = step.startedAt || Date.now();
    } else if (step.status === "en_proceso") {
        step.status = "finalizado";
        step.endedAt = step.endedAt || Date.now();
        if (i < cur.steps.length - 1) cur.current = i + 1;
    } else {
        if (i < cur.steps.length - 1) cur.current = i + 1;
    }

    cur.updatedAt = Date.now();
    setControl(cur);
}

function syncControlTimer() {
    if (controlTimer) clearInterval(controlTimer);

    const st = getControl();
    if (!st?.running) return;

    controlTimer = setInterval(() => {
        const cur = getControl();
        if (!cur.running) return;

        // Si ya terminó todo, pausa
        if (cur.current >= cur.steps.length) {
            cur.running = false;
            cur.updatedAt = Date.now();
            setControl(cur);
            return;
        }

        advanceControlStepManual();
        const active = document.querySelector('[data-view="control"]')?.classList.contains("is-active");
        if (active) {
            renderControl($("viewRoot"));
        }
    }, 3500);
}

/* =========================
   Boot
   ========================= */
initLoginHandlers();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (isAppMode()) goLogin();
        $("loginView").hidden = false;
        $("appView").hidden = true;
        return;
    }

    if (!isAppMode()) {
        goApp("#inicio");
        return;
    }

    const profile = await loadProfile(user.uid);
    if (!profile || profile.active === false) {
        await signOut(auth);
        goLogin();
        return;
    }

    initApp(profile, user);
    syncControlTimer();
});