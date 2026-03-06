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

/* Firebase */
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

/* Params */
const params = new URLSearchParams(window.location.search);
const isAppMode = params.get("app") === "1";

/* Set modo en el body para ocultar login por CSS */
document.body.classList.toggle("is-app", isAppMode);

/* Views */
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");

/* Login UI */
const loginForm = document.getElementById("loginForm");
const username = document.getElementById("username");
const password = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");
const usernameError = document.getElementById("usernameError");
const passwordError = document.getElementById("passwordError");
const togglePassword = document.getElementById("togglePassword");
const btnLogin = document.getElementById("btnLogin");
const forgotPassword = document.getElementById("forgotPassword");
const goRegister = document.getElementById("goRegister");
const toastLogin = document.getElementById("toastLogin");

/* Panel UI */
const sidebar = document.getElementById("sidebar");
const btnMenuMobile = document.getElementById("btnMenuMobile");
const btnLogout = document.getElementById("btnLogout");
const btnNavToggle = document.getElementById("btnNavToggle");

const roleText = document.getElementById("roleText");
const nameText = document.getElementById("nameText");
const topName = document.getElementById("topName");
const topRole = document.getElementById("topRole");
const avatarChip = document.getElementById("avatarChip");
const navUsuarios = document.getElementById("navUsuarios");

const heroInicio = document.getElementById("heroInicio");
const heroVentas = document.getElementById("heroVentas");
const inicioUser = document.getElementById("inicioUser");
const inicioRole = document.getElementById("inicioRole");

const kpiVentasHoy = document.getElementById("kpiVentasHoy");
const kpiStockBajo = document.getElementById("kpiStockBajo");
const kpiOrdenes = document.getElementById("kpiOrdenes");

const panelTitle = document.getElementById("panelTitle");
const panelDesc = document.getElementById("panelDesc");
const panelBody = document.getElementById("panelBody");
const toastDash = document.getElementById("toastDash");

/* Helpers */
const REMEMBER_KEY = "lcm_remember_user";

function setToast(el, msg, type = "ok") {
    if (!el) return;
    el.style.display = "";
    el.textContent = msg;
    el.className = "toast " + (type === "ok" ? "toast--ok" : "toast--error");
}
function resetToast(el) {
    if (!el) return;
    el.style.display = "";
    el.textContent = "";
    el.className = "toast";
}
function clearErrors() {
    if (usernameError) usernameError.textContent = "";
    if (passwordError) passwordError.textContent = "";
}
function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(v).trim());
}

function showLogin() {
    dashboardView.hidden = true;
    loginView.hidden = false;
}
function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
}

/* Recargas */
function reloadToApp(hash = "#inicio") {
    const base = window.location.pathname;
    window.location.replace(`${base}?app=1${hash}`);
}
function reloadToLogin() {
    const base = window.location.pathname;
    window.location.replace(`${base}`);
}

/* Logos */
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
loadLogoInto(document.getElementById("brandLogo"));
loadLogoInto(document.getElementById("brandLogoMini"));

/* Firestore profile */
async function loadProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data();
}

/* HERO switch (KPIs solo ventas) */
function showHeroFor(view) {
    heroVentas.classList.toggle("hidden", view !== "ventas");
    heroInicio.classList.toggle("hidden", view !== "inicio");
}

/* Nav active */
function setActiveNav(view) {
    document.querySelectorAll(".nav__item").forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.view === view);
    });
}

/* Render views */
function renderView(view, profile) {
    setActiveNav(view);
    showHeroFor(view);

    const views = {
        inicio: {
            title: "Inicio",
            desc: "Bienvenida e información del usuario.",
            body: () => `
        <div class="grid2">
          <div class="box">
            <h3 class="box__title">Atajos</h3>
            <div class="chips">
              <button class="chip" data-view="ventas">Ir a ventas</button>
              <button class="chip" data-view="inventario">Ver inventario</button>
              <button class="chip" data-view="produccion">Registrar producción</button>
            </div>
          </div>
          <div class="box">
            <h3 class="box__title">Sesión</h3>
            <ul class="list">
              <li><b>Usuario:</b> ${profile?.name || "—"}</li>
              <li><b>Rol:</b> ${(profile?.role || "—").toUpperCase()}</li>
              <li><b>Estado:</b> ${profile?.active === false ? "INACTIVO" : "ACTIVO"}</li>
            </ul>
          </div>
        </div>
      `
        },
        inventario: {
            title: "Inventario",
            desc: "Entradas, salidas, stock mínimo y ajustes.",
            body: () => `<div class="box"><h3 class="box__title">Inventario</h3><p class="list">Placeholder</p></div>`
        },
        ventas: {
            title: "Ventas",
            desc: "Registro de ventas y control de caja.",
            body: () => `<div class="box"><h3 class="box__title">Ventas</h3><p class="list">Placeholder</p></div>`
        },
        produccion: {
            title: "Producción",
            desc: "Lotes, recetas, mermas y trazabilidad.",
            body: () => `<div class="box"><h3 class="box__title">Producción</h3><p class="list">Placeholder</p></div>`
        },
        compras: {
            title: "Compras",
            desc: "Proveedores y órdenes de compra.",
            body: () => `<div class="box"><h3 class="box__title">Compras</h3><p class="list">Placeholder</p></div>`
        },
        reportes: {
            title: "Reportes",
            desc: "KPIs y reportes exportables.",
            body: () => `<div class="box"><h3 class="box__title">Reportes</h3><p class="list">Placeholder</p></div>`
        },
        usuarios: {
            title: "Usuarios",
            desc: "Gestión de usuarios (solo admin).",
            body: () => `<div class="box"><h3 class="box__title">Usuarios</h3><p class="list">Placeholder</p></div>`
        }
    };

    const v = views[view] || views.inicio;
    panelTitle.textContent = v.title;
    panelDesc.textContent = v.desc;
    panelBody.innerHTML = v.body();

    panelBody.querySelectorAll("[data-view]").forEach(el => {
        el.addEventListener("click", () => renderView(el.dataset.view, profile));
    });
}

/* Apply profile */
function applyProfile(profile) {
    const role = String(profile?.role || "sin_rol");
    const name = profile?.name || "Usuario";
    const isAdmin = role === "admin";

    roleText.textContent = role.toUpperCase();
    nameText.textContent = name;
    topRole.textContent = role.toUpperCase();
    topName.textContent = name;

    const initials = name.split(" ").slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "LC";
    avatarChip.textContent = initials;

    inicioUser.textContent = name;
    inicioRole.textContent = role.toUpperCase();

    navUsuarios.style.display = isAdmin ? "flex" : "none";

    // KPIs placeholder
    kpiVentasHoy.textContent = "$ —";
    kpiStockBajo.textContent = "—";
    kpiOrdenes.textContent = "—";

    document.querySelectorAll(".nav__item").forEach(btn => {
        btn.onclick = () => {
            const view = btn.dataset.view;
            if (view === "usuarios" && !isAdmin) return;
            renderView(view, profile);
            if (window.matchMedia("(max-width: 860px)").matches) sidebar.classList.remove("is-open");
        };
    });

    renderView("inicio", profile);
}

/* (3) Toggle menú inferior */
btnNavToggle?.addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("is-nav-collapsed");
    btnNavToggle.setAttribute("aria-expanded", (!collapsed).toString());
});

/* Mobile sidebar */
btnMenuMobile?.addEventListener("click", () => sidebar.classList.toggle("is-open"));

/* Logout */
btnLogout?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        reloadToLogin();
    } catch (err) {
        console.error(err);
        setToast(toastDash, "No se pudo cerrar sesión.", "error");
    }
});

/* Remember */
(function initRemember() {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { username.value = saved; rememberMe.checked = true; }
})();

/* Toggle password */
togglePassword?.addEventListener("click", () => {
    const hidden = password.type === "password";
    password.type = hidden ? "text" : "password";
    togglePassword.textContent = hidden ? "◠" : "👁";
});

/* Forgot password */
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

/* Register disabled */
goRegister?.addEventListener("click", (e) => {
    e.preventDefault();
    setToast(toastLogin, "Registro deshabilitado. Pide al admin que cree tu usuario.", "error");
});

/* Login submit -> recarga a ?app=1 */
loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    resetToast(toastLogin);

    const email = username.value.trim();
    const pass = password.value;

    let ok = true;
    if (!email || !isValidEmail(email)) { usernameError.textContent = "Ingresa un correo válido."; ok = false; }
    if (!pass || pass.length < 6) { passwordError.textContent = "Contraseña mínima 6 caracteres."; ok = false; }
    if (!ok) { setToast(toastLogin, "Revisa los campos.", "error"); return; }

    btnLogin.disabled = true;
    btnLogin.textContent = "VALIDANDO...";

    try {
        await setPersistence(auth, rememberMe.checked ? browserLocalPersistence : browserSessionPersistence);
        const cred = await signInWithEmailAndPassword(auth, email, pass);

        if (rememberMe.checked) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);

        // Validar perfil antes de recargar
        const profile = await loadProfile(cred.user.uid);
        if (!profile) {
            setToast(toastLogin, "Ingresaste, pero falta tu perfil en Firestore (users/{UID}).", "error");
            await signOut(auth);
            return;
        }
        if (profile.active === false) {
            setToast(toastLogin, "Usuario desactivado.", "error");
            await signOut(auth);
            return;
        }

        reloadToApp("#inicio");
    } catch (err) {
        console.error(err);
        setToast(toastLogin, "Error al iniciar sesión.", "error");
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "INICIAR SESIÓN";
    }
});

/* Auth guard */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (isAppMode) reloadToLogin();
        else showLogin();
        return;
    }

    // Si está logueado pero no en modo app, fuerza recarga a app
    if (!isAppMode) {
        reloadToApp("#inicio");
        return;
    }

    // Modo app: mostrar panel y eliminar login del DOM (para que no exista en el scroll)
    try {
        const profile = await loadProfile(user.uid);
        if (!profile || profile.active === false) {
            await signOut(auth);
            reloadToLogin();
            return;
        }

        showDashboard();

        // CLAVE: eliminar login completamente para que desaparezca del scroll
        if (loginView) loginView.remove();

        applyProfile(profile);
        resetToast(toastDash);
    } catch (err) {
        console.error(err);
        await signOut(auth);
        reloadToLogin();
    }
});