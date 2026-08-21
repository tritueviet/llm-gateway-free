"use strict";

/* ------------------------------------------------------------------ theme */

const THEME_KEY = "aigw-theme";
const ICON_SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/>';
const ICON_MOON = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>';

function effectiveTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paintThemeIcon() {
  const icon = document.getElementById("theme-icon");
  icon.innerHTML = effectiveTheme() === "dark" ? ICON_SUN : ICON_MOON;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
  paintThemeIcon();
  document.getElementById("theme-btn").addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    paintThemeIcon();
  });
}

/* -------------------------------------------------------------------- nav */

const PAGE_META = {
  overview: ["Tổng quan", "Trạng thái gateway theo thời gian thực"],
  playground: ["Prompt", "Gửi prompt tới đích danh một client, bỏ qua routing"],
  clients: ["Clients", "Toàn bộ client agent, online và offline"],
  capabilities: ["Web & CLI", "Công cụ mà các client có thể chạy được"],
  usage: ["Token sử dụng", "Số token đã tiêu thụ theo từng client"],
  requests: ["Requests", "Lịch sử request gần đây"],
  routing: ["Routing", "Thuật toán phân phối tải giữa các client"],
  cache: ["Cache", "Trạng thái response cache"],
};

const DEFAULT_VIEW = "overview";

const BASE_PATH = "/dashboard";

/**
 * Each sidebar entry is a real URL (`/dashboard/clients`), so a page can be
 * linked, bookmarked, and reloaded in place.
 *
 * This relies on the SPA fallback in `packages/server/src/http/app.ts`, which
 * serves index.html for every known page path — express.static alone would 404
 * on reload. A view added to PAGE_META must also be added to DASHBOARD_PAGES
 * there, or its URL breaks on refresh.
 */
function showView(view) {
  const known = Object.prototype.hasOwnProperty.call(PAGE_META, view) ? view : DEFAULT_VIEW;

  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.toggle("active", n.dataset.view === known));
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === `view-${known}`));

  const [title, sub] = PAGE_META[known];
  document.getElementById("page-title").textContent = title;
  document.getElementById("page-sub").textContent = sub;
  document.title = `${title} · AI Gateway`;
  return known;
}

/** `/dashboard/clients` -> `clients`; anything unrecognised falls back. */
function viewFromPath() {
  const raw = decodeURIComponent(window.location.pathname).replace(/\/+$/, "").split("/").pop();
  return Object.prototype.hasOwnProperty.call(PAGE_META, raw) ? raw : DEFAULT_VIEW;
}

/**
 * Canonical URL for a view. The default view lives at `/dashboard/` — with the
 * trailing slash, because express.static 301s `/dashboard` there, and matching
 * it keeps the pathname comparisons in navigate()/initNav() honest.
 */
function pathForView(view) {
  return view === DEFAULT_VIEW ? `${BASE_PATH}/` : `${BASE_PATH}/${view}`;
}

/** Render a view and give it its own history entry. */
function navigate(view) {
  const known = showView(view);
  const url = pathForView(known);
  if (url !== window.location.pathname) history.pushState({ view: known }, "", url);
}

function initNav() {
  /** A plain left-click, i.e. not one the browser should handle itself. */
  const isPlainClick = (e) =>
    !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  // Sidebar entries are real <a href> elements so they stay middle-clickable
  // and copyable, which means the default navigation has to be cancelled here —
  // without preventDefault the browser follows the href and reloads the whole
  // document (all CSS/JS/fonts re-fetched, visible flicker).
  document.getElementById("nav").addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (!item || !isPlainClick(e)) return;
    e.preventDefault();
    navigate(item.dataset.view);
  });

  // Same treatment for in-page links to a dashboard page (e.g. the overview
  // routing card). Modified clicks are left alone: open-in-new-tab must work.
  document.addEventListener("click", (e) => {
    if (!isPlainClick(e)) return;
    const link = e.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.origin !== window.location.origin) return;
    if (link.closest("#nav")) return;
    const view = decodeURIComponent(link.pathname).replace(/\/+$/, "").split("/").pop();
    if (!Object.prototype.hasOwnProperty.call(PAGE_META, view)) return;
    e.preventDefault();
    navigate(view);
  });

  // Back/forward: render only — pushing here would trap the back button.
  window.addEventListener("popstate", () => showView(viewFromPath()));

  // Normalise the bar on first load (a trailing slash or an unknown page
  // becomes the canonical path) via replaceState, so no bogus back entry.
  const view = viewFromPath();
  const canonical = pathForView(view);
  if (window.location.pathname !== canonical) {
    history.replaceState({ view }, "", canonical);
  }
  showView(view);
}

/* ------------------------------------------------------------------ utils */

const fmtNum = (n) => (n === null || n === undefined || Number.isNaN(n) ? "0" : Math.round(n).toLocaleString());

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 0 || diff < 10_000) return "vừa xong";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} giây trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

function fmtMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function statusBadge(status) {
  const cls = status === "online" || status === "ok" ? "online" : status === "offline" || status === "error" ? "offline" : "pending";
  return `<span class="badge ${cls}"><span class="dot ${cls === "online" ? "live" : cls === "offline" ? "down" : ""}"></span>${esc(status)}</span>`;
}

async function api(path, opts) {
  const options = { ...opts };
  // Teko IAM bearer token, when the gateway has admin auth enabled. Attached
  // here because every /api/* call funnels through this helper.
  const token = window.AigwAuth?.getAccessToken?.();
  if (token) options.headers = { ...(options.headers ?? {}), Authorization: `Bearer ${token}` };

  const res = await fetch(path, options);
  if (res.status === 401 || res.status === 403) {
    // The token is missing, expired, or belongs to someone without access.
    // Re-running login is the only useful recovery, and it must not be done
    // from a render loop, so it is delegated to the auth module.
    window.AigwAuth?.onUnauthorised?.(res.status);
    throw new Error(res.status === 401 ? "signed out — redirecting to login" : "your account is not authorised for this dashboard");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.message || `${path} → HTTP ${res.status}`);
  }
  return res.json();
}

function toast(msg, isErr) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.toggle("err", !!isErr);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ------------------------------------------------------- provider glyphs */

/**
 * Simplified single-path marks, drawn to sit on a 24x24 grid and inherit
 * currentColor. Deliberately not the official brand logos: those are
 * trademarked and must not be redrawn or recoloured, so these are neutral
 * geometric stand-ins keyed by provider id.
 */
const PROVIDER_ICON = {
  chatgpt: '<path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6z"/><circle cx="12" cy="12" r="3"/>',
  claude: '<path d="M7.5 18 12 5.6 16.5 18"/><path d="M9.4 13.6h5.2"/>',
  gemini: '<path d="M12 3.2 L13.6 10.4 L20.8 12 L13.6 13.6 L12 20.8 L10.4 13.6 L3.2 12 L10.4 10.4 Z"/>',
  deepseek: '<path d="M3.6 9.2 C7.4 5.4 13.6 5.6 17.2 9.4 C18.8 11 19.8 13 20.4 15.2"/><circle cx="8.6" cy="14.6" r="2.6"/>',
  grok: '<path d="M5 19 19 5"/><path d="M9.5 19H5v-4.5"/><path d="M19 9.5V5h-4.5"/>',
  perplexity: '<path d="M12 4v16"/><path d="M12 8.5 5.5 4v9.5a6.5 6.5 0 0 0 13 0V4L12 8.5z"/>',
  duck: '<circle cx="12" cy="12" r="8.4"/><circle cx="9.8" cy="10.4" r="1"/><path d="M8.8 15.4 C10.9 14.1 13.1 14.1 15.2 15.4"/>',
  mockweb: '<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2"/><path d="M3.4 9.6h17.2"/>',
};

/** Keyed separately: "claude" is both a web provider and a CLI. */
const CLI_ICON = {
  // the Claude "A" mark inside a terminal frame — related to web/claude, not identical
  claude: '<rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2"/><path d="M8.8 16 12 8.2 15.2 16"/><path d="M10.2 13.4h3.6"/>',
  opencode: '<path d="M12 3.4 20 8v8l-8 4.6L4 16V8z"/><path d="m9.4 10.4-2 1.6 2 1.6"/><path d="m14.6 10.4 2 1.6-2 1.6"/>',
  echo: '<path d="M4 12h3l2.6-5 3.4 10 2.4-5H20"/>',
};

/** Fallback marks when a capability id matches no known provider. */
const KIND_ICON = {
  web: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4a14 14 0 0 1 0 17.2a14 14 0 0 1 0-17.2"/>',
  cli: '<rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2"/><path d="m7 10 2.6 2.6L7 15.2"/><path d="M12.8 15.4h4"/>',
};

/** "web/chatgpt" | "cli/claude" -> "chatgpt" | "claude" */
function providerKey(cap) {
  const raw = String(cap.capabilityId || cap.id || "");
  const slug = raw.includes("/") ? raw.slice(raw.indexOf("/") + 1) : raw;
  return slug.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Official brand marks. Two CDNs, because neither covers the whole set:
 *
 *   lobehub  — has OpenAI, Grok and OpenCode, which simple-icons dropped on
 *              trademark request. "-color" variants exist for most; OpenAI and
 *              Grok are monochrome by brand design and inherit currentColor.
 *   simpleicons — used only for DuckDuckGo, which lobehub does not carry.
 *
 * Artwork is served unmodified; only the documented colour variant is chosen.
 */
const LOBE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons";
const SIMPLE = "https://cdn.simpleicons.org";

const BRAND_CDN = {
  chatgpt: `${LOBE}/openai.svg`,
  claude: `${LOBE}/claude-color.svg`,
  gemini: `${LOBE}/gemini-color.svg`,
  deepseek: `${LOBE}/deepseek-color.svg`,
  grok: `${LOBE}/grok.svg`,
  perplexity: `${LOBE}/perplexity-color.svg`,
  duck: `${SIMPLE}/duckduckgo/DE5833`,
};

const BRAND_CLI_CDN = {
  // Claude Code has its own mark, distinct from the Claude web logo.
  claude: `${SIMPLE}/claudecode/D97757`,
  opencode: `${LOBE}/opencode.svg`,
};

/**
 * Monochrome marks inherit the surrounding text colour, so they stay legible
 * in both themes. Colour marks must not be tinted — they ship brand-correct.
 */
const MONO_BRAND = new Set([`${LOBE}/openai.svg`, `${LOBE}/grok.svg`, `${LOBE}/opencode.svg`]);

function providerIcon(cap, kind) {
  // "claude" exists as both web/claude and cli/claude, so the two maps stay
  // separate: a CLI never falls through to a web glyph.
  const key = providerKey(cap);
  const url = kind === "cli" ? BRAND_CLI_CDN[key] : BRAND_CDN[key];
  const path = (kind === "cli" ? CLI_ICON[key] : PROVIDER_ICON[key]) || KIND_ICON[kind];
  const drawn = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

  if (!url) return drawn;

  // The drawn mark sits underneath as the fallback: if the CDN is blocked or
  // offline the <img> errors and removes itself, so the cell is never empty.
  // A monochrome mark is painted through a mask so it picks up currentColor —
  // an <img> cannot be recoloured, and black-on-dark would vanish.
  const layer = MONO_BRAND.has(url)
    ? `<i class="mono-mark" style="-webkit-mask-image:url('${url}');mask-image:url('${url}')"></i>`
    : `<img src="${url}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />`;

  return `<span class="brand-mark">${drawn}${layer}</span>`;
}

function capChip(cap) {
  const kind = cap.kind === "browser" ? "web" : "cli";
  const name = cap.displayName || cap.capabilityId || cap.id;
  const avail = cap.available !== false;
  return `<span class="cap-chip ${kind}${avail ? "" : " unavailable"}" title="${esc(cap.reason || "")}">${providerIcon(cap, kind)}${esc(name)}</span>`;
}

/**
 * Only what the client can actually serve right now. The unavailable ones are
 * noise in a client row — a probe reports every known backend whether or not
 * it is usable, so an idle agent would otherwise show ten dead chips. The full
 * catalogue, including what is offline and why, lives in the Web & CLI view.
 */
function capChips(caps) {
  const list = (caps || []).filter((c) => c.available !== false);
  if (!list.length) return '<span class="muted">Chưa có capability khả dụng</span>';
  return `<div class="chip-wrap">${list.map(capChip).join("")}</div>`;
}

/* --------------------------------------------------------------- fetching */

let lastData = { health: null, clients: null, capabilities: null, usage: null, requests: null, routing: null, cache: null };

async function loadAll() {
  try {
    const [health, clients, capabilities, usage, requests, routing] = await Promise.all([
      api("/health"),
      api("/api/clients"),
      api("/api/capabilities"),
      api("/api/usage/clients"),
      api("/api/requests?limit=50"),
      api("/api/settings/routing"),
    ]);
    lastData = { health, clients, capabilities, usage, requests, routing, cache: health.cache };
    setConn(true);
    renderOverview();
    renderPlayground();
    renderClients();
    renderCapabilities();
    renderUsage();
    renderRequests();
    renderRouting();
    renderCache();
  } catch (err) {
    setConn(false);
    console.error(err);
  }
}

function setConn(ok) {
  document.getElementById("conn-dot").className = `dot ${ok ? "live" : "down"}`;
  document.getElementById("conn-text").textContent = ok ? "Đã kết nối" : "Mất kết nối";
}

/* ---------------------------------------------------------------- render */

function renderOverview() {
  const { health, clients, capabilities, usage } = lastData;
  if (!health) return;
  document.getElementById("stat-clients-online").textContent = fmtNum(health.clients);
  document.getElementById("nav-clients-count").textContent = fmtNum(health.clients);
  const totalKnown = clients?.persisted?.length ?? health.clients;
  document.getElementById("stat-clients-total").textContent = `${fmtNum(totalKnown)} tổng cộng từng thấy`;
  document.getElementById("stat-active-jobs").textContent = fmtNum(health.activeJobs);
  const webCount = (capabilities?.capabilities || []).filter((c) => c.kind === "browser").length;
  const cliCount = (capabilities?.capabilities || []).filter((c) => c.kind === "cli").length;
  document.getElementById("stat-capabilities").textContent = fmtNum(webCount + cliCount);
  document.getElementById("stat-cap-breakdown").textContent = `${webCount} web · ${cliCount} cli`;
  const totalTokens = (usage?.clients || []).reduce((n, c) => n + (c.total_tokens || 0), 0);
  document.getElementById("stat-tokens").textContent = fmtNum(totalTokens);
  const totalReq = (usage?.clients || []).reduce((n, c) => n + (c.requests || 0), 0);
  document.getElementById("stat-requests-total").textContent = `${fmtNum(totalReq)} request`;

  const live = clients?.live || [];
  document.getElementById("clients-live-hint").textContent = `${live.length} online`;
  const rows = live.map(
    (c) => `<tr>
      <td><strong>${esc(c.name)}</strong><div class="mono">${esc(c.clientId)}</div></td>
      <td>${esc(c.platform)}</td>
      <td class="mono">${esc(c.remoteAddr)}</td>
      <td class="num">${c.activeJobs}/${c.maxConcurrency}</td>
      <td>${capChips(c.capabilities)}</td>
    </tr>`,
  );
  document.getElementById("tbl-overview-clients").innerHTML =
    rows.join("") || '<tr class="empty-row"><td colspan="5">Chưa có client nào kết nối</td></tr>';

  renderRoutingOverviewCard();
}

const STRATEGY_LABEL = {
  "least-busy": "Ít tải nhất",
  "round-robin": "Round robin",
  "fill-first": "Lấp đầy dần",
  "ip-hash": "Hash theo IP",
};

function renderRoutingOverviewCard() {
  const r = lastData.routing;
  if (!r) return;
  document.getElementById("overview-routing").innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
      <span class="badge neutral">${esc(STRATEGY_LABEL[r.strategy] || r.strategy)}</span>
    </div>
    <p class="muted" style="margin:0 0 12px;">${esc(STRATEGY_DESC[r.strategy]?.text || "")}</p>
    <a href="/dashboard/routing" class="btn" style="text-decoration:none;">Đổi chiến lược →</a>
  `;
  // A plain href now does the navigation: the hashchange listener renders it,
  // so no click handler is needed and the link is middle-clickable.
}

/* -------------------------------------------------------------- dropdowns */

/**
 * Tom Select instances keyed by element id. The library is loaded from a CDN,
 * so every use is guarded: if it failed to load (offline, blocked egress, CSP)
 * `window.TomSelect` is undefined and the plain <select> keeps working. That
 * fallback is deliberate — this dashboard is expected to run on hosts with no
 * outbound internet.
 */
const selects = {};

const TOM_OPTS = {
  create: false,
  allowEmptyOption: true,
  controlInput: null, // no search box; these lists are short
  plugins: [],
  render: {
    no_results: () => '<div class="no-results">Không có kết quả</div>',
  },
};

function initSelect(id, opts = {}) {
  if (!window.TomSelect) return null;
  const el = document.getElementById(id);
  if (!el || selects[id]) return selects[id] || null;
  selects[id] = new TomSelect(el, { ...TOM_OPTS, ...opts });
  return selects[id];
}

/**
 * Current value of a dropdown.
 *
 * Tom Select takes over the <select> and holds the user's choice in its own
 * state, so reading `.value` off the element returns whatever was last written
 * programmatically — not what the operator actually picked. Always go through
 * here, or a manual selection is silently lost on the next 5s refresh.
 */
function selectValue(id) {
  const ts = selects[id];
  if (ts) {
    const v = ts.getValue();
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  }
  return document.getElementById(id)?.value ?? "";
}

/**
 * The populate* functions rewrite <select>.innerHTML wholesale. Tom Select
 * caches its own option list, so it has to be rebuilt from the DOM afterwards
 * or the visible list goes stale.
 */
function syncSelect(id) {
  const ts = selects[id];
  if (!ts) return;
  const el = document.getElementById(id);

  // Captured before clearOptions/clear, both of which blank the underlying
  // <select>. Reading it afterwards yields "" and loses the caller's pick.
  const wanted = el.value;
  const first = [...el.querySelectorAll("option")].find((o) => o.value)?.value ?? "";

  ts.clearOptions();
  ts.clear(true);
  for (const opt of el.querySelectorAll("option")) {
    if (!opt.value && !opt.textContent.trim()) continue;
    ts.addOption({ value: opt.value, text: opt.textContent });
  }
  ts.refreshOptions(false);

  // Re-assert the selection the populate* function just made — either the
  // operator's retained choice or the auto-picked first entry, so the form is
  // runnable on a fresh load instead of showing an empty control.
  const want = wanted || first;
  if (want) {
    ts.setValue(want, true);
    el.value = want;
  }

  if (el.disabled) ts.disable();
  else ts.enable();
}

/* ------------------------------------------------------------- playground */

function renderPlayground() {
  const live = lastData.clients?.live || [];
  const clientSel = document.getElementById("pg-client");
  const prevClient = selectValue("pg-client");
  clientSel.innerHTML = live.length
    ? live.map((c) => `<option value="${esc(c.clientId)}">${esc(c.name)} — ${esc(c.clientId)}</option>`).join("")
    : `<option value="">Không có client online</option>`;
  clientSel.disabled = live.length === 0;
  // Keep the operator's pick across the 5s refresh; otherwise fall back to the
  // first entry so the form is runnable without three manual selections.
  clientSel.value = live.some((c) => c.clientId === prevClient)
    ? prevClient
    : (live[0]?.clientId ?? "");
  syncSelect("pg-client");
  populatePlaygroundCapabilities();
}

function playgroundClient() {
  const live = lastData.clients?.live || [];
  return live.find((c) => c.clientId === selectValue("pg-client"));
}

function populatePlaygroundCapabilities() {
  const capSel = document.getElementById("pg-capability");
  const prevCap = selectValue("pg-capability");
  const caps = (playgroundClient()?.capabilities || []).filter((c) => c.available);
  capSel.innerHTML = caps.length
    ? caps.map((c) => `<option value="${esc(c.id)}">${c.kind === "browser" ? "Web" : "CLI"} · ${esc(c.displayName)}</option>`).join("")
    : `<option value="">Client chưa có capability khả dụng</option>`;
  capSel.disabled = caps.length === 0;
  capSel.value = caps.some((c) => c.id === prevCap) ? prevCap : (caps[0]?.id ?? "");
  syncSelect("pg-capability");
  populatePlaygroundSubmodels();
}

function populatePlaygroundSubmodels() {
  const capSel = document.getElementById("pg-capability");
  const subField = document.getElementById("pg-submodel-field");
  const subSel = document.getElementById("pg-submodel");
  const cap = (playgroundClient()?.capabilities || []).find((c) => c.id === selectValue("pg-capability"));
  const models = cap?.models || [];
  if (!models.length) {
    subField.style.display = "none";
    subSel.innerHTML = "";
    syncSelect("pg-submodel");
    return;
  }
  const prev = selectValue("pg-submodel");
  subSel.innerHTML = models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  subSel.value = models.includes(prev) ? prev : models[0];
  syncSelect("pg-submodel");
  subField.style.display = "";
}

function pgAppend(text) {
  const out = document.getElementById("pg-output");
  if (out.dataset.empty === "1") {
    out.textContent = "";
    out.dataset.empty = "0";
  }
  out.textContent += text;
  out.scrollTop = out.scrollHeight;
}

async function runPlayground() {
  const clientId = selectValue("pg-client");
  const capabilityId = selectValue("pg-capability");
  const subField = document.getElementById("pg-submodel-field");
  const subModel = subField.style.display !== "none" ? document.getElementById("pg-submodel").value : undefined;
  const prompt = document.getElementById("pg-prompt").value.trim();
  const runBtn = document.getElementById("pg-run");
  const statusEl = document.getElementById("pg-status");
  const outputEl = document.getElementById("pg-output");
  const metaEl = document.getElementById("pg-meta");

  if (!clientId || !capabilityId) {
    toast("Chọn client và capability trước", true);
    return;
  }
  if (!prompt) {
    toast("Nhập prompt trước khi chạy", true);
    return;
  }

  runBtn.disabled = true;
  statusEl.textContent = "Đang gửi…";
  metaEl.textContent = "";
  outputEl.textContent = "";
  outputEl.dataset.empty = "1";

  try {
    const res = await fetch("/api/test-prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, capabilityId, subModel, prompt }),
    });

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        let ev;
        try {
          ev = JSON.parse(payload);
        } catch {
          continue;
        }
        applyPlaygroundEvent(ev, { statusEl, metaEl });
      }
    }
  } catch (err) {
    statusEl.textContent = "Lỗi";
    pgAppend(`\n⚠ ${err.message || err}`);
  } finally {
    runBtn.disabled = false;
  }
}

function applyPlaygroundEvent(ev, { statusEl, metaEl }) {
  if (ev.type === "start") {
    statusEl.textContent = `Đã gửi tới ${ev.clientId}…`;
    return;
  }
  if (ev.type === "accepted") {
    statusEl.textContent = "Client đã nhận job, đang xử lý…";
    return;
  }
  if (ev.type === "chunk") {
    pgAppend(ev.delta);
    return;
  }
  if (ev.type === "done") {
    statusEl.textContent = "Hoàn tất";
    if (document.getElementById("pg-output").dataset.empty === "1" && ev.content) pgAppend(ev.content);
    const u = ev.usage || {};
    metaEl.textContent = `${fmtNum(u.totalTokens)} token · ${fmtMs(ev.latencyMs)} · ${esc(ev.finishReason || "stop")}`;
    return;
  }
  if (ev.type === "error") {
    statusEl.textContent = "Lỗi";
    pgAppend(`\n\n⚠ [${ev.code}] ${ev.message}`);
    return;
  }
}

function renderClients() {
  const { clients } = lastData;
  if (!clients) return;
  const liveMap = new Map((clients.live || []).map((c) => [c.clientId, c]));
  const rows = (clients.persisted || []).map((p) => {
    const live = liveMap.get(p.id);
    const activeJobs = live ? live.activeJobs : 0;
    return `<tr>
      <td><strong>${esc(p.name)}</strong><div class="mono">${esc(p.id)}</div></td>
      <td>${statusBadge(p.status)}</td>
      <td>${esc(p.platform || "—")}</td>
      <td class="mono">${esc(p.remote_addr || "—")}</td>
      <td class="num">${activeJobs}/${p.max_concurrency}</td>
      <td class="num">${fmtNum(p.total_jobs)}</td>
      <td class="num">${p.failed_jobs ? `<span style="color:var(--danger)">${fmtNum(p.failed_jobs)}</span>` : "0"}</td>
      <td>${capChips(p.capabilities)}</td>
      <td class="muted">${timeAgo(p.last_seen_at)}</td>
    </tr>`;
  });
  document.getElementById("tbl-clients").innerHTML =
    rows.join("") || '<tr class="empty-row"><td colspan="9">Chưa có client nào từng kết nối</td></tr>';
}

/**
 * The full catalogue of backends the gateway knows about, merged from two
 * sources:
 *   /api/capabilities — only what is live, and carries clients/slots counts
 *   /api/clients      — every backend each agent probed, including the ones
 *                       reporting unavailable plus the reason why
 * The union is what the system *can* support; the flags say what it can serve
 * right now. Without the merge an offline provider vanishes from the list
 * entirely, which reads as "not supported" rather than "nobody is serving it".
 */
function catalogue(kind) {
  const byId = new Map();

  for (const c of lastData.capabilities?.capabilities || []) {
    if (c.kind !== kind) continue;
    byId.set(c.id, { ...c, available: true });
  }

  for (const client of lastData.clients?.live || []) {
    for (const cap of client.capabilities || []) {
      if (cap.kind !== kind) continue;
      const seen = byId.get(cap.id);
      if (!seen) {
        byId.set(cap.id, {
          id: cap.id,
          kind: cap.kind,
          displayName: cap.displayName || cap.id,
          models: cap.models || [],
          clients: 0,
          slots: 0,
          available: cap.available !== false,
          reason: cap.reason || "",
        });
      } else if (!seen.models?.length && cap.models?.length) {
        seen.models = cap.models;
      }
    }
  }

  // available first, then alphabetical — a usable backend is the thing you look for
  return [...byId.values()].sort(
    (a, b) => Number(b.available) - Number(a.available) || a.id.localeCompare(b.id),
  );
}

function renderCapTable(elId, list) {
  const chipKind = elId.endsWith("web") ? "web" : "cli";
  const rows = list.map((c) => {
    const chips = (c.models || [])
      .map((m) => `<span class="cap-chip ${c.available ? chipKind : "off"}">${esc(m)}</span>`)
      .join("");
    const models = chips ? `<div class="chip-wrap">${chips}</div>` : "";
    const status = c.available
      ? '<span class="pill ok">Sẵn sàng</span>'
      : `<span class="pill off" title="${esc(c.reason || "")}">Không khả dụng</span>`;
    return `<tr${c.available ? "" : ' class="row-off"'}>
      <td><div class="cap-name">${providerIcon(c, c.kind === "browser" ? "web" : "cli")}<div><strong>${esc(c.displayName)}</strong><div class="mono">${esc(c.id)}</div></div></div></td>
      <td>${status}</td>
      <td class="num">${fmtNum(c.clients)}</td>
      <td class="num">${fmtNum(c.slots)}</td>
      <td>${models || '<span class="muted">—</span>'}</td>
    </tr>`;
  });
  document.getElementById(elId).innerHTML =
    rows.join("") || `<tr class="empty-row"><td colspan="5">Chưa có capability nào</td></tr>`;
}

function renderCapabilities() {
  renderCapTable("tbl-cap-web", catalogue("browser"));
  renderCapTable("tbl-cap-cli", catalogue("cli"));
}

function renderUsage() {
  const list = lastData.usage?.clients || [];
  const maxTokens = Math.max(1, ...list.map((c) => c.total_tokens || 0));
  const rows = list.map((c) => {
    const pct = Math.round(((c.total_tokens || 0) / maxTokens) * 100);
    return `<tr>
      <td><strong>${esc(c.name || c.client_id)}</strong><div class="mono">${esc(c.client_id)}</div></td>
      <td>${statusBadge(c.status)}</td>
      <td class="num">${fmtNum(c.requests)}</td>
      <td class="num">${fmtNum(c.ok)}</td>
      <td class="num">${c.errors ? `<span style="color:var(--danger)">${fmtNum(c.errors)}</span>` : "0"}</td>
      <td class="num">${fmtNum(c.prompt_tokens)}</td>
      <td class="num">${fmtNum(c.completion_tokens)}</td>
      <td class="num"><strong>${fmtNum(c.total_tokens)}</strong></td>
      <td><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></td>
      <td class="num">${fmtMs(c.avg_latency_ms)}</td>
    </tr>`;
  });
  document.getElementById("tbl-usage").innerHTML =
    rows.join("") || '<tr class="empty-row"><td colspan="10">Chưa có dữ liệu sử dụng</td></tr>';
}

function renderRequests() {
  const list = lastData.requests?.requests || [];
  const rows = list.map(
    (r) => `<tr>
      <td class="muted">${timeAgo(r.created_at)}</td>
      <td class="mono">${esc(r.model)}</td>
      <td class="mono">${esc(r.client_id || "—")}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="num">${r.attempts ?? 0}</td>
      <td>${r.cache_hit ? '<span class="badge ok">hit</span>' : '<span class="muted">miss</span>'}</td>
      <td class="num">${fmtNum(r.total_tokens)}</td>
      <td class="num">${fmtMs(r.latency_ms)}</td>
    </tr>`,
  );
  document.getElementById("tbl-requests").innerHTML =
    rows.join("") || '<tr class="empty-row"><td colspan="8">Chưa có request nào</td></tr>';
}

const STRATEGY_DESC = {
  "least-busy": {
    icon: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    text: "Chọn client còn nhiều slot rảnh nhất tại thời điểm dispatch. Cân bằng tải sát thực tế nhất, mặc định khuyến nghị.",
  },
  "round-robin": {
    icon: '<path d="M17 2.1 21 6l-4 3.9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21.9 3 18l4-3.9"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    text: "Luân phiên tuần tự qua từng client theo thứ tự cố định, không quan tâm tải hiện tại. Đơn giản, phân bổ đều số lượng request.",
  },
  "fill-first": {
    icon: '<rect x="3" y="10" width="4" height="10"/><rect x="10" y="6" width="4" height="14"/><rect x="17" y="3" width="4" height="17"/>',
    text: "Dồn đầy một client trước khi chuyển sang client kế tiếp. Phù hợp khi muốn giữ các máy còn lại rảnh để tiết kiệm tài nguyên.",
  },
  "ip-hash": {
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>',
    text: "Băm địa chỉ IP của người gọi để luôn định tuyến về cùng một client (sticky session) khi client đó còn khả dụng — hữu ích khi cần tính nhất quán theo người dùng/phiên.",
  },
};

let selectedStrategy = null;

function renderStrategyGrid() {
  const grid = document.getElementById("strategy-grid");
  if (grid.dataset.built) return;
  grid.dataset.built = "1";
  // default first, so the recommended strategy is what the eye lands on
  const order = ["ip-hash", "least-busy", "round-robin", "fill-first"];
  grid.innerHTML = order
    .map(
      (key) => `<label class="strategy-option" data-key="${key}">
        <input type="radio" name="strategy" value="${key}" />
        <div class="name-row">
          <div class="name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${STRATEGY_DESC[key].icon}</svg>${esc(STRATEGY_LABEL[key])}</div>
          <div class="check"></div>
        </div>
        <div class="desc">${esc(STRATEGY_DESC[key].text)}</div>
      </label>`,
    )
    .join("");
  grid.querySelectorAll(".strategy-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      selectedStrategy = opt.dataset.key;
      grid.querySelectorAll(".strategy-option").forEach((o) => o.classList.toggle("selected", o === opt));
    });
  });
}

function renderRouting() {
  renderStrategyGrid();
  const current = lastData.routing?.strategy;
  if (!selectedStrategy) selectedStrategy = current;
  document.querySelectorAll(".strategy-option").forEach((o) => o.classList.toggle("selected", o.dataset.key === selectedStrategy));
  document.getElementById("strategy-current-label").textContent = `Đang áp dụng: ${STRATEGY_LABEL[current] || current}`;
}

function renderCache() {
  const c = lastData.cache;
  if (!c) return;
  document.getElementById("cache-entries").textContent = `${fmtNum(c.memoryEntries)} / ${fmtNum(c.diskEntries)}`;
  document.getElementById("cache-hits-mem").textContent = fmtNum(c.hitsMemory);
  document.getElementById("cache-hits-disk").textContent = fmtNum(c.hitsDisk);
  document.getElementById("cache-misses").textContent = fmtNum(c.misses);
}

/* ---------------------------------------------------------------- wiring */

function initActions() {
  document.getElementById("refresh-btn").addEventListener("click", loadAll);

  // Enhance the three playground selects. Tom Select forwards a native
  // `change` on the original element, so the listeners below are unaffected.
  initSelect("pg-client");
  initSelect("pg-capability");
  initSelect("pg-submodel");

  document.getElementById("pg-client").addEventListener("change", populatePlaygroundCapabilities);
  document.getElementById("pg-capability").addEventListener("change", populatePlaygroundSubmodels);
  document.getElementById("pg-run").addEventListener("click", runPlayground);

  document.getElementById("apply-strategy").addEventListener("click", async (e) => {
    if (!selectedStrategy) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api("/api/settings/routing", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategy: selectedStrategy }),
      });
      toast(`Đã áp dụng: ${STRATEGY_LABEL[selectedStrategy] || selectedStrategy}`);
      await loadAll();
    } catch (err) {
      toast(err.message || "Không thể áp dụng", true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("clear-cache-btn").addEventListener("click", async () => {
    try {
      await api("/api/cache", { method: "DELETE" });
      toast("Đã xoá cache");
      await loadAll();
    } catch (err) {
      toast(err.message || "Không thể xoá cache", true);
    }
  });
}

initTheme();
initNav();
initActions();
loadAll();
setInterval(loadAll, 5000);
