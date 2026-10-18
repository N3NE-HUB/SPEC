/* ===================================================
   app.js — NodeCheck main logic
   ===================================================

   HOW IT WORKS:
   1. Calls ip-api.com (free, no key needed) to get ISP + location.
   2. Loads status.json to check Highsplit status for that ZIP / city.
   3. On report submit, POSTs to your Google Apps Script web app URL.

   SETUP: Replace GOOGLE_SCRIPT_URL below with your own.
   =================================================== */

// ── CONFIG ──────────────────────────────────────────
// After you deploy your Google Apps Script, paste the URL here:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwG2wNJkiT7YhxOw4_dZyqAaWAAludrR84O9QuU16N0GSSY8_K9KS5MqMXPsXKdMWN/exec";

// ── STATE ────────────────────────────────────────────
let detectedData = {};

// ── ENTRY POINT ──────────────────────────────────────
async function runCheck() {
  const btn = document.getElementById("checkBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Checking…`;

  document.getElementById("spinner").style.display   = "flex";
  document.getElementById("results").style.display   = "none";

  try {
    // 1. Fetch IP data
    const ipData = await fetchIpData();

    // 2. Fetch Highsplit status data
    const statusData = await fetchStatusData();

    // 3. Render results
    renderResults(ipData, statusData);

    document.getElementById("spinner").style.display = "none";
    document.getElementById("results").style.display = "block";
    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    console.error(err);
    document.getElementById("spinner").style.display = "none";
    alert("⚠️ Unable to look up your connection. Please check your internet and try again.");
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">🔍</span> Check My Node Now`;
  }
}

// ── IP LOOKUP ─────────────────────────────────────────
async function fetchIpData() {
  // ip-api.com is free for non-commercial use (no API key needed)
  const res  = await fetch("https://ip-api.com/json/?fields=status,message,country,regionName,city,zip,isp,org,as,query");
  const data = await res.json();
  if (data.status !== "success") throw new Error(data.message || "IP lookup failed");
  return data;
}

// ── STATUS DATA ───────────────────────────────────────
async function fetchStatusData() {
  try {
    const res  = await fetch("status.json?nocache=" + Date.now());
    return await res.json();
  } catch {
    return { areas: [] }; // graceful fallback if file missing
  }
}

// ── RENDER RESULTS ────────────────────────────────────
function renderResults(ip, statusData) {
  // -- Fill hidden form fields for report submission --
  detectedData = { ip, statusData };
  document.getElementById("rIp").value   = ip.query   || "";
  document.getElementById("rIsp").value  = ip.isp     || "";
  document.getElementById("rCity").value = ip.city    || "";
  document.getElementById("rState").value= ip.regionName || "";

  // -- Provider detection --
  const providerInfo = detectProvider(ip.isp || "", ip.org || "", ip.as || "");
  const legacyLabel  = providerInfo.legacy;
  const badgeClass   = providerInfo.badgeClass;

  // -- Fill info grid --
  document.getElementById("ipVal").textContent     = ip.query      || "Unknown";
  document.getElementById("ispVal").textContent    = ip.isp        || "Unknown";
  document.getElementById("legacyVal").textContent = legacyLabel;
  document.getElementById("asnVal").textContent    = ip.as         || "Unknown";
  document.getElementById("locVal").textContent    = [ip.city, ip.regionName, ip.country].filter(Boolean).join(", ") || "Unknown";
  document.getElementById("zipVal").textContent    = ip.zip        || "Unknown";

  // -- Status badge --
  const badge = document.getElementById("statusBadge");
  badge.textContent  = legacyLabel;
  badge.className    = "badge " + badgeClass;

  // -- Auto-select provider in form --
  const providerSelect = document.getElementById("rProvider");
  for (let opt of providerSelect.options) {
    if (opt.value && legacyLabel.toLowerCase().includes(opt.value.toLowerCase().split(" ")[0])) {
      providerSelect.value = opt.value;
      break;
    }
  }

  // -- Auto-fill ZIP in form --
  if (ip.zip) document.getElementById("rZip").value = ip.zip;

  // -- Highsplit status --
  renderHighsplit(ip, statusData, providerInfo);
}

// ── PROVIDER DETECTION ────────────────────────────────
function detectProvider(isp, org, asn) {
  const text = [isp, org, asn].join(" ").toLowerCase();

  // Spectrum / Charter (merged entity + legacy Charter markets)
  if (text.includes("charter") || text.includes("spectrum")) {
    return { legacy: "Charter / Spectrum",   badgeClass: "charter" };
  }
  // Time Warner Cable markets (now Spectrum)
  if (text.includes("time warner") || text.includes("twc") || text.includes("roadrunner")) {
    return { legacy: "Time Warner Cable (TWC) → Spectrum", badgeClass: "twc" };
  }
  // Cox Communications
  if (text.includes("cox")) {
    return { legacy: "Cox Communications",   badgeClass: "cox" };
  }
  // Generic Spectrum detection by ASN
  // AS11351 = TWC, AS20001 = TWC/Spectrum, AS7843 = Charter, AS22773 = Cox
  if (text.includes("as11351") || text.includes("11351")) {
    return { legacy: "Time Warner Cable (TWC) → Spectrum", badgeClass: "twc" };
  }
  if (text.includes("as7843")  || text.includes("7843")) {
    return { legacy: "Charter / Spectrum",   badgeClass: "charter" };
  }
  if (text.includes("as22773") || text.includes("22773")) {
    return { legacy: "Cox Communications",   badgeClass: "cox" };
  }
  if (text.includes("comcast") || text.includes("xfinity")) {
    return { legacy: "Comcast / Xfinity",   badgeClass: "other" };
  }
  if (text.includes("verizon")) {
    return { legacy: "Verizon",              badgeClass: "other" };
  }
  if (text.includes("at&t") || text.includes("att ")) {
    return { legacy: "AT&T",                 badgeClass: "other" };
  }
  return { legacy: isp || "Unknown Provider", badgeClass: "other" };
}

// ── HIGHSPLIT STATUS ──────────────────────────────────
function renderHighsplit(ip, statusData, providerInfo) {
  const box     = document.getElementById("highsplitBox");
  const icon    = document.getElementById("highsplitIcon");
  const title   = document.getElementById("highsplitTitle");
  const desc    = document.getElementById("highsplitDesc");
  const etaWrap = document.getElementById("etaBadge");
  const etaVal  = document.getElementById("etaVal");

  const zip   = (ip.zip  || "").toLowerCase();
  const city  = (ip.city || "").toLowerCase();
  const state = (ip.regionName || "").toLowerCase();

  // Find a match in status.json
  const areas  = (statusData && statusData.areas) ? statusData.areas : [];
  let   match  = null;

  for (const area of areas) {
    const zips   = (area.zipCodes  || []).map(z => z.toLowerCase());
    const cities = (area.cities    || []).map(c => c.toLowerCase());
    const states = (area.states    || []).map(s => s.toLowerCase());

    if (
      (zip   && zips.some(z => z === zip))   ||
      (city  && cities.some(c => c === city) && states.some(s => s === state))
    ) {
      match = area;
      break;
    }
  }

  if (!match) {
    // No match — check if this is even a Spectrum-family provider
    const isSpectrum = ["charter", "twc", "cox", "spectrum"].some(k => providerInfo.badgeClass === k);
    if (!isSpectrum) {
      icon.textContent   = "ℹ️";
      title.textContent  = "Provider Not Spectrum-Family";
      desc.textContent   = `We detected your provider as "${providerInfo.legacy}". This site specifically tracks Spectrum, TWC, Charter, and Cox node upgrades.`;
      box.className      = "highsplit-box none";
      etaWrap.style.display = "none";
      return;
    }
    // Spectrum provider but no status entry for this area
    icon.textContent   = "🔍";
    title.textContent  = "No Status Data for Your Area Yet";
    desc.textContent   = `We don't have specific Highsplit/node split data for ${ip.city || "your city"}, ${ip.regionName || "your state"} (ZIP: ${ip.zip || "unknown"}) yet. You can submit a report below to help us track it!`;
    box.className      = "highsplit-box none";
    etaWrap.style.display = "none";
    return;
  }

  // We have a match — render by status
  const s = (match.status || "").toLowerCase();

  if (s === "in-progress" || s === "active") {
    icon.textContent   = "🚧";
    title.textContent  = "Highsplit / Node Split Is Actively Underway!";
    desc.textContent   = `Construction or node-split work is currently in progress in your area (${match.areaName || ip.city}). You may experience intermittent outages or disruptions during this time.`;
    box.className      = "highsplit-box active";
  } else if (s === "planned" || s === "scheduled") {
    icon.textContent   = "📅";
    title.textContent  = "Highsplit Is Planned for Your Area";
    desc.textContent   = `A node split / Highsplit upgrade is scheduled for ${match.areaName || ip.city}. Work has not yet begun, but improvements are coming.`;
    box.className      = "highsplit-box planned";
  } else if (s === "complete" || s === "completed" || s === "done") {
    icon.textContent   = "✅";
    title.textContent  = "Highsplit Is Complete in Your Area!";
    desc.textContent   = `The node split upgrade for ${match.areaName || ip.city} has been finished. Speeds and reliability should be noticeably improved.`;
    box.className      = "highsplit-box complete";
  } else {
    icon.textContent   = "❓";
    title.textContent  = "Status: " + (match.status || "Unknown");
    desc.textContent   = match.notes || "Check back later for updates.";
    box.className      = "highsplit-box none";
  }

  // ETA
  if (match.eta && s !== "complete" && s !== "completed" && s !== "done") {
    etaWrap.style.display = "inline-flex";
    etaVal.textContent    = match.eta;
  } else {
    etaWrap.style.display = "none";
  }

  // Extra notes
  if (match.notes) {
    desc.textContent += " — " + match.notes;
  }
}

// ── REPORT SUBMISSION ────────────────────────────────
async function submitReport(e) {
  e.preventDefault();

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Submitting…`;

  const formSuccess = document.getElementById("formSuccess");
  const formError   = document.getElementById("formError");
  formSuccess.style.display = "none";
  formError.style.display   = "none";

  const payload = {
    timestamp:   new Date().toISOString(),
    name:        document.getElementById("rName").value     || "",
    email:       document.getElementById("rEmail").value    || "",
    zip:         document.getElementById("rZip").value      || "",
    provider:    document.getElementById("rProvider").value || "",
    status:      document.getElementById("rStatus").value   || "",
    notes:       document.getElementById("rNotes").value    || "",
    ip:          document.getElementById("rIp").value       || "",
    isp:         document.getElementById("rIsp").value      || "",
    city:        document.getElementById("rCity").value     || "",
    state:       document.getElementById("rState").value    || "",
  };

  // Check if the script URL has been configured
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
    // Fallback: save to localStorage for demo purposes
    const existing = JSON.parse(localStorage.getItem("nodecheck_reports") || "[]");
    existing.push(payload);
    localStorage.setItem("nodecheck_reports", JSON.stringify(existing));
    formSuccess.style.display = "flex";
    document.getElementById("reportForm").reset();
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">📤</span> Submit My Report`;
    return;
  }

  try {
    // Google Apps Script accepts form-encoded POST
    const body = new URLSearchParams(payload).toString();
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode:   "no-cors",  // required for Google Apps Script
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    formSuccess.style.display = "flex";
    document.getElementById("reportForm").reset();
    // re-fill auto-detected fields
    if (detectedData.ip) {
      document.getElementById("rIp").value    = detectedData.ip.query    || "";
      document.getElementById("rIsp").value   = detectedData.ip.isp      || "";
      document.getElementById("rCity").value  = detectedData.ip.city     || "";
      document.getElementById("rState").value = detectedData.ip.regionName || "";
    }
  } catch (err) {
    console.error(err);
    formError.style.display = "flex";
  }

  btn.disabled = false;
  btn.innerHTML = `<span class="btn-icon">📤</span> Submit My Report`;
}
