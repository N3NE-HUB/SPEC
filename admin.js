/* ===================================================
   admin.js — WhoIsMyProvider Admin Panel
   ===================================================
   SETUP: Change ADMIN_PASSWORD to your own password.
   Paste the same GOOGLE_SCRIPT_URL from app.js.
   =================================================== */

const ADMIN_PASSWORD    = "sss";             // ← CHANGE THIS
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwG2wNJkiT7YhxOw4_dZyqAaWAAludrR84O9QuU16N0GSSY8_K9KS5MqMXPsXKdMWN/exec"; // ← same as app.js

const SESSION_KEY = "wimp_admin_auth";

window.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem(SESSION_KEY) === "true") showDashboard();
});

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

function showDashboard() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminDash").style.display   = "block";
  loadReports();
}

async function loadReports() {
  const tbody   = document.getElementById("reportsBody");
  const countEl = document.getElementById("reportCount");
  let   reports = [];

  if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL + "?action=get");
      const data = await res.json();
      reports = Array.isArray(data) ? data : (data.reports || []);
    } catch (err) {
      console.warn("Google Script fetch failed, using localStorage:", err);
    }
  }

  if (reports.length === 0) {
    reports = JSON.parse(localStorage.getItem("wimp_reports") || "[]");
  }

  countEl.textContent = reports.length + " report" + (reports.length !== 1 ? "s" : "");

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" class="empty-state">No reports yet — share your site!</td></tr>`;
    return;
  }

  reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  tbody.innerHTML = reports.map((r, i) => `
    <tr>
      <td>${reports.length - i}</td>
      <td>${fmtDate(r.timestamp)}</td>
      <td>${esc(r.name)    || "<em style='opacity:.4'>—</em>"}</td>
      <td>${esc(r.zip)     || "—"}</td>
      <td><strong>${esc(r.legacy)   || esc(r.provider) || "—"}</strong></td>
      <td style="font-size:.78rem;">${esc(r.isp)      || "—"}</td>
      <td style="font-family:monospace;font-size:.78rem;">${esc(r.asn)   || "—"}</td>
      <td style="font-family:monospace;font-size:.72rem;max-width:160px;word-break:break-all;">${esc(r.rdns)  || "—"}</td>
      <td>${esc(r.status)  || "—"}</td>
      <td>${esc(r.city)    || "—"}</td>
      <td>${esc(r.state)   || "—"}</td>
      <td style="font-family:monospace;font-size:.78rem;">${esc(r.ip)    || "—"}</td>
      <td>${esc(r.email)   || "<em style='opacity:.4'>—</em>"}</td>
      <td style="max-width:180px;white-space:pre-wrap;font-size:.78rem;">${esc(r.notes) || "—"}</td>
    </tr>
  `).join("");
}

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
  a.href = url; a.download = "wimp_reports_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click(); URL.revokeObjectURL(url);
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"});
  } catch { return iso; }
}
