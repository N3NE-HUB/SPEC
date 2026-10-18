/* ===================================================
   admin.js — Admin panel logic
   ===================================================

   SETUP: Replace ADMIN_PASSWORD and GOOGLE_SCRIPT_URL
   with your actual values before uploading to GitHub.

   ADMIN_PASSWORD — pick any password you like.
   GOOGLE_SCRIPT_URL — same URL from app.js, but used
     here with ?action=get to fetch stored reports.
   =================================================== */

// ── CONFIG ──────────────────────────────────────────
const ADMIN_PASSWORD    = "naborcito";     // ← CHANGE THIS
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwG2wNJkiT7YhxOw4_dZyqAaWAAludrR84O9QuU16N0GSSY8_K9KS5MqMXPsXKdMWN/exec"; // ← same as app.js

// Session key
const SESSION_KEY = "nodecheck_admin_auth";

// ── ON LOAD ───────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    showDashboard();
  }
});

// ── LOGIN ────────────────────────────────────────────
function login() {
  const pass = document.getElementById("adminPass").value;
  if (pass === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, "true");
    document.getElementById("loginError").style.display = "none";
    showDashboard();
  } else {
    document.getElementById("loginError").style.display = "flex";
    document.getElementById("adminPass").value = "";
    document.getElementById("adminPass").focus();
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById("adminDash").style.display   = "none";
  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("adminPass").value = "";
}

// ── SHOW DASHBOARD ────────────────────────────────────
function showDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminDash").style.display   = "block";
  loadReports();
}

// ── LOAD REPORTS ──────────────────────────────────────
async function loadReports() {
  const tbody = document.getElementById("reportsBody");
  const countEl = document.getElementById("reportCount");

  let reports = [];

  // Try Google Apps Script first
  if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
    try {
      const res  = await fetch(GOOGLE_SCRIPT_URL + "?action=get");
      const data = await res.json();
      reports = Array.isArray(data) ? data : (data.reports || []);
    } catch (err) {
      console.warn("Could not load from Google Script, falling back to localStorage:", err);
    }
  }

  // Fallback: localStorage (used when Google Script not configured)
  if (reports.length === 0) {
    reports = JSON.parse(localStorage.getItem("nodecheck_reports") || "[]");
  }

  countEl.textContent = reports.length + " report" + (reports.length !== 1 ? "s" : "");

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">No reports submitted yet.</td></tr>`;
    return;
  }

  // Sort newest first
  reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  tbody.innerHTML = reports.map((r, i) => `
    <tr>
      <td>${reports.length - i}</td>
      <td>${formatDate(r.timestamp)}</td>
      <td>${esc(r.name)  || "<em style='opacity:.4'>—</em>"}</td>
      <td>${esc(r.zip)   || "—"}</td>
      <td>${esc(r.provider) || "—"}</td>
      <td>${esc(r.status) || "—"}</td>
      <td>${esc(r.city)  || "—"}</td>
      <td>${esc(r.state) || "—"}</td>
      <td style="font-size:.78rem;font-family:monospace;">${esc(r.ip) || "—"}</td>
      <td>${esc(r.email) || "<em style='opacity:.4'>—</em>"}</td>
      <td style="max-width:200px;white-space:pre-wrap;font-size:.8rem;">${esc(r.notes) || "—"}</td>
    </tr>
  `).join("");
}

// ── CSV EXPORT ────────────────────────────────────────
function exportCsv() {
  const rows  = document.querySelectorAll("#reportsTable tr");
  const lines = [];
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll("th,td")).map(c =>
      '"' + c.innerText.replace(/"/g, '""') + '"'
    );
    lines.push(cells.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "nodecheck_reports_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── UTILS ────────────────────────────────────────────
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month:"short", day:"numeric", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    });
  } catch { return iso; }
}
