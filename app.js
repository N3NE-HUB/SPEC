/* ===================================================
   app.js — WhoIsMyProvider
   ===================================================
   Detects visitor's IP, RDNS hostname, ISP, ASN,
   and maps them to their legacy cable provider.

   SETUP: Replace GOOGLE_SCRIPT_URL with your deployed
   Google Apps Script URL (see setup guide).
   =================================================== */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwG2wNJkiT7YhxOw4_dZyqAaWAAludrR84O9QuU16N0GSSY8_K9KS5MqMXPsXKdMWN/exec";

// ─────────────────────────────────────────────────────
// PROVIDER DATABASE
// Maps ISP name keywords, ASNs, and RDNS patterns
// to a legacy brand.
// ─────────────────────────────────────────────────────
const PROVIDERS = [
  {
    key:       "twc",
    name:      "Time Warner Cable",
    subName:   "Now operated as Spectrum (acquired 2016)",
    badge:     "TWC → Spectrum",
    logo:      "🔵",
    bannerClass: "banner-twc",
    asnList:   ["11351","10796","20001","33588","7016"],
    ispKeywords: ["time warner","twc","roadrunner","rr.com","hsd"],
    rdnsPatterns: ["rr.com","twc.com","roadrunner"],
    description: "Your connection is running on the Time Warner Cable (TWC) network, which was acquired by Charter Communications in 2016 and rebranded as Spectrum. The underlying infrastructure — nodes, DNS servers, and IP blocks — still carries TWC identifiers in many areas."
  },
  {
    key:       "charter",
    name:      "Charter Communications",
    subName:   "Operating as Spectrum",
    badge:     "Charter / Spectrum",
    logo:      "🟣",
    bannerClass: "banner-charter",
    asnList:   ["7843","11426","20115","10507","4181"],
    ispKeywords: ["charter","spectrum","brighthouse","bhn"],
    rdnsPatterns: ["charter.com","res.bhn.net","twmi.res","mi.res.rr","midsouth.rr","brighthouse"],
    description: "Your connection is on the Charter Communications network, which operates under the Spectrum brand. Charter has been expanding its fiber and node-split infrastructure aggressively since merging with TWC and Bright House Networks."
  },
  {
    key:       "cox",
    name:      "Cox Communications",
    subName:   "Now part of Spectrum (acquired 2024)",
    badge:     "Cox → Spectrum",
    logo:      "🟠",
    bannerClass: "banner-cox",
    asnList:   ["22773","18780","7534"],
    ispKeywords: ["cox","cox.net","cox communications"],
    rdnsPatterns: ["cox.net","coxip"],
    description: "Your connection is on the Cox Communications network. Cox was acquired by Charter/Spectrum in 2024, making it the latest addition to the Spectrum family. Your IP range and DNS still carry Cox identifiers as the transition continues."
  },
  {
    key:       "spectrum",
    name:      "Spectrum",
    subName:   "Charter Communications brand",
    badge:     "Spectrum",
    logo:      "⚪",
    bannerClass: "banner-spectrum",
    asnList:   [],
    ispKeywords: ["spectrum"],
    rdnsPatterns: ["spectrum.com","spectrumip"],
    description: "Your connection is identified as Spectrum — the unified brand used by Charter Communications after merging with Time Warner Cable, Bright House Networks, and Cox. Your node may originally have been from any of those legacy networks."
  },
  {
    key:       "comcast",
    name:      "Comcast / Xfinity",
    subName:   "Largest US cable provider",
    badge:     "Comcast / Xfinity",
    logo:      "🔴",
    bannerClass: "banner-comcast",
    asnList:   ["7922","33651","21508","13367","33491"],
    ispKeywords: ["comcast","xfinity"],
    rdnsPatterns: ["comcast.net","comcastbusiness","xfinity"],
    description: "Your connection is on the Comcast network, which operates under the Xfinity brand for residential service. Comcast is the largest cable internet provider in the US by subscriber count."
  },
  {
    key:       "verizon",
    name:      "Verizon",
    subName:   "FiOS / Home Internet",
    badge:     "Verizon",
    logo:      "🔴",
    bannerClass: "banner-other",
    asnList:   ["701","6167","19262"],
    ispKeywords: ["verizon","fios","vzw"],
    rdnsPatterns: ["verizon.net","fios.verizon"],
    description: "Your connection is on the Verizon network. Verizon offers fiber (FiOS) and DSL service in parts of the Northeast US."
  },
  {
    key:       "att",
    name:      "AT&T",
    subName:   "Fiber / DSL",
    badge:     "AT&T",
    logo:      "🔵",
    bannerClass: "banner-other",
    asnList:   ["7018","8794","13979","20057"],
    ispKeywords: ["at&t","att internet","att broadband","sbc","sbcglobal"],
    rdnsPatterns: ["att.net","sbcglobal.net","sbis.net"],
    description: "Your connection is on the AT&T network, which provides DSL and fiber (AT&T Fiber) internet service across the US."
  },
  {
    key:       "centurylink",
    name:      "CenturyLink / Lumen",
    subName:   "Also known as Quantum Fiber",
    badge:     "CenturyLink",
    logo:      "🟡",
    bannerClass: "banner-other",
    asnList:   ["209","3561","4181"],
    ispKeywords: ["centurylink","lumen","quantum fiber","embarq","qwest"],
    rdnsPatterns: ["centurytel.net","centurylink.net","qwest.net"],
    description: "Your connection is on the CenturyLink / Lumen / Quantum Fiber network."
  },
  {
    key:       "tmobile",
    name:      "T-Mobile Home Internet",
    subName:   "5G Fixed Wireless",
    badge:     "T-Mobile",
    logo:      "🩷",
    bannerClass: "banner-other",
    asnList:   ["21928","13749"],
    ispKeywords: ["t-mobile","tmobile","sprint"],
    rdnsPatterns: ["tmo.net","t-mobile"],
    description: "Your connection is on the T-Mobile network, typically delivered via 5G fixed wireless home internet."
  },
  {
    key:       "wow",
    name:      "WideOpenWest (WOW!)",
    subName:   "Regional cable provider",
    badge:     "WOW!",
    logo:      "🌀",
    bannerClass: "banner-other",
    asnList:   ["22616","40285"],
    ispKeywords: ["wideopenwest","wow internet","wowway"],
    rdnsPatterns: ["wowway.net","wideopenwest"],
    description: "Your connection is on WideOpenWest (WOW!), a regional cable internet provider."
  },
  {
    key:       "suddenlink",
    name:      "Suddenlink / Optimum",
    subName:   "Altice USA brand",
    badge:     "Suddenlink / Optimum",
    logo:      "🟢",
    bannerClass: "banner-other",
    asnList:   ["32107","6128","20214"],
    ispKeywords: ["suddenlink","optimum","cablevision","altice"],
    rdnsPatterns: ["suddenlink.net","optonline.net","optimum.net"],
    description: "Your connection is on the Suddenlink / Optimum network, operated by Altice USA."
  },
  {
    key:       "mediacom",
    name:      "Mediacom",
    subName:   "Regional cable provider",
    badge:     "Mediacom",
    logo:      "🟦",
    bannerClass: "banner-other",
    asnList:   ["30036","11232"],
    ispKeywords: ["mediacom"],
    rdnsPatterns: ["mediacombb.net","mediacom"],
    description: "Your connection is on the Mediacom network, a regional cable provider serving the Midwest and Southeast."
  }
];

const UNKNOWN_PROVIDER = {
  key: "other", name: "Unknown / Other Provider",
  subName: "Could not identify legacy brand",
  badge: "Other ISP", logo: "❓",
  bannerClass: "banner-other",
  description: "We were unable to match your connection to a known provider in our database. Your ISP name and ASN are shown above."
};

// ─────────────────────────────────────────────────────
// MAIN LOOKUP
// ─────────────────────────────────────────────────────
let detectedData = {};

async function runLookup() {
  const btn = document.getElementById("checkBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Looking up…`;

  document.getElementById("spinner").style.display  = "flex";
  document.getElementById("results").style.display  = "none";

  try {
    const ipData = await fetchIpData();
    renderResults(ipData);
    document.getElementById("spinner").style.display = "none";
    document.getElementById("results").style.display = "block";
    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    document.getElementById("spinner").style.display = "none";
    alert("⚠️ Could not look up your connection details. Please check your internet and try again.");
  }

  btn.disabled = false;
  btn.innerHTML = `<span class="btn-icon">🔍</span> Look Up My Connection`;
}

// ─────────────────────────────────────────────────────
// IP FETCH — uses ipwho.is (free, HTTPS, no key needed)
// Falls back to ipapi.co if ipwho.is fails.
// Then fetches Reverse DNS via Google DNS-over-HTTPS.
// ─────────────────────────────────────────────────────
async function fetchIpData() {
  let raw = null;

  // Primary: ipwho.is (supports HTTPS, no API key)
  try {
    const res = await fetch("https://ipwho.is/");
    raw = await res.json();
    if (!raw.success) raw = null;
  } catch (e) { raw = null; }

  // Fallback: ipapi.co (also free HTTPS)
  if (!raw) {
    const res = await fetch("https://ipapi.co/json/");
    const fb  = await res.json();
    if (fb.error) throw new Error(fb.reason || "IP lookup failed");
    // Normalize ipapi.co format
    raw = {
      success:    true,
      ip:         fb.ip,
      city:       fb.city,
      region:     fb.region,
      postal:     fb.postal,
      country:    fb.country_name,
      timezone:   { id: fb.timezone },
      connection: { asn: parseInt((fb.asn||"").replace("AS","")), isp: fb.org, org: fb.org }
    };
  }

  const conn   = raw.connection || {};
  const asnNum = conn.asn || "";
  const isp    = conn.isp || conn.org || "";

  // Normalize to a single format our app understands
  const data = {
    query:      raw.ip          || "",
    isp:        isp,
    org:        conn.org        || isp,
    as:         asnNum ? `AS${asnNum} ${isp}` : "",
    asname:     isp,
    reverse:    "",                          // filled below
    city:       raw.city        || "",
    regionName: raw.region      || "",
    zip:        raw.postal      || "",
    country:    raw.country     || "",
    timezone:   (raw.timezone && raw.timezone.id) || "",
    mobile:     false,
    proxy:      false,
    hosting:    false,
  };

  // Reverse DNS via Google DNS-over-HTTPS (no mixed-content issue)
  try { data.reverse = await fetchRdns(data.query); } catch (e) { /* ignore */ }

  return data;
}

// ─────────────────────────────────────────────────────
// REVERSE DNS LOOKUP
// Uses Google's DNS-over-HTTPS API (always HTTPS, free)
// Looks up PTR record for the visitor's IP address.
// ─────────────────────────────────────────────────────
async function fetchRdns(ip) {
  if (!ip) return "";
  // Convert "1.2.3.4" → "4.3.2.1.in-addr.arpa" for PTR lookup
  const reversed = ip.split(".").reverse().join(".") + ".in-addr.arpa";
  const res  = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(reversed)}&type=PTR`,
    { headers: { Accept: "application/json" } }
  );
  const json = await res.json();
  if (json.Answer && json.Answer.length > 0) {
    // Remove trailing dot that DNS responses include
    return json.Answer[0].data.replace(/\.$/, "");
  }
  return "";
}

// ─────────────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────────────
function renderResults(d) {
  detectedData = d;

  // Identify provider
  const provider = detectProvider(d);

  // ── Provider banner ──
  const banner = document.getElementById("providerBanner");
  banner.className = "provider-banner " + provider.bannerClass;
  document.getElementById("providerLogo").textContent  = provider.logo;
  document.getElementById("providerName").textContent  = provider.name;
  document.getElementById("providerSub").textContent   = provider.subName;
  document.getElementById("providerBadge").textContent = provider.badge;

  // ── Detail grid ──
  set("dIp",       d.query      || "Unknown");
  set("dRdns",     d.reverse    || "No reverse DNS record found");
  set("dIsp",      d.isp        || "Unknown");
  set("dAsn",      d.as         || "Unknown");
  set("dCity",     d.city       || "Unknown");
  set("dRegion",   d.regionName || "Unknown");
  set("dZip",      d.zip        || "Unknown");
  set("dCountry",  d.country    || "Unknown");
  set("dTimezone", d.timezone   || "Unknown");
  set("dLegacy",   provider.badge);

  // Connection type
  let connType = "Residential Broadband";
  if (d.mobile)   connType = "📱 Mobile / Cellular";
  else if (d.hosting) connType = "🏢 Datacenter / Hosting";
  else if (d.proxy)   connType = "🛡️ VPN / Proxy / Tor";
  set("dType", connType);

  // VPN / Proxy
  if (d.proxy) {
    set("dProxy", "⚠️ VPN or Proxy Detected");
    document.getElementById("dProxy").style.color = "var(--warning)";
  } else {
    set("dProxy", "✅ No VPN/Proxy Detected");
    document.getElementById("dProxy").style.color = "var(--green)";
  }

  // ── Explanation card ──
  document.getElementById("explainIcon").textContent  = provider.logo;
  document.getElementById("explainTitle").textContent = provider.name + " Detected";
  document.getElementById("explainDesc").textContent  = provider.description;

  // ── Auto-fill hidden report fields ──
  setVal("rProvider", d.isp        || provider.name);
  setVal("rZip",      d.zip        || "");
  setVal("rIp",       d.query      || "");
  setVal("rIsp",      d.isp        || "");
  setVal("rAsn",      d.as         || "");
  setVal("rRdns",     d.reverse    || "");
  setVal("rCity",     d.city       || "");
  setVal("rState",    d.regionName || "");
  setVal("rLegacy",   provider.badge);
}

// ─────────────────────────────────────────────────────
// PROVIDER DETECTION ENGINE
// Checks (in order): ASN → ISP name keywords → RDNS
// ─────────────────────────────────────────────────────
function detectProvider(d) {
  const asnRaw  = (d.as      || "").toLowerCase();
  const isp     = (d.isp     || "").toLowerCase();
  const org     = (d.org     || "").toLowerCase();
  const rdns    = (d.reverse || "").toLowerCase();
  const asname  = (d.asname  || "").toLowerCase();

  // Extract numeric ASN (e.g. "AS11351" → "11351")
  const asnNum  = asnRaw.replace(/^as/i, "").split(" ")[0];

  for (const p of PROVIDERS) {
    // 1. Check ASN
    if (p.asnList.includes(asnNum)) return p;

    // 2. Check ISP / org / asname keywords
    const allText = [isp, org, asname].join(" ");
    if (p.ispKeywords.some(kw => allText.includes(kw))) return p;

    // 3. Check RDNS hostname
    if (rdns && p.rdnsPatterns.some(pat => rdns.includes(pat))) return p;
  }

  return UNKNOWN_PROVIDER;
}

// ─────────────────────────────────────────────────────
// REPORT SUBMISSION
// ─────────────────────────────────────────────────────
async function submitReport(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Submitting…`;

  document.getElementById("formSuccess").style.display = "none";
  document.getElementById("formError").style.display   = "none";

  const payload = {
    timestamp: new Date().toISOString(),
    name:      document.getElementById("rName").value    || "",
    email:     document.getElementById("rEmail").value   || "",
    provider:  document.getElementById("rProvider").value|| "",
    zip:       document.getElementById("rZip").value     || "",
    status:    document.getElementById("rStatus").value  || "",
    notes:     document.getElementById("rNotes").value   || "",
    ip:        document.getElementById("rIp").value      || "",
    isp:       document.getElementById("rIsp").value     || "",
    asn:       document.getElementById("rAsn").value     || "",
    rdns:      document.getElementById("rRdns").value    || "",
    city:      document.getElementById("rCity").value    || "",
    state:     document.getElementById("rState").value   || "",
    legacy:    document.getElementById("rLegacy").value  || "",
  };

  // If no script URL set → save to localStorage (demo mode)
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
    const existing = JSON.parse(localStorage.getItem("wimp_reports") || "[]");
    existing.push(payload);
    localStorage.setItem("wimp_reports", JSON.stringify(existing));
    document.getElementById("formSuccess").style.display = "flex";
    document.getElementById("reportForm").reset();
    reApplyHidden();
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">📤</span> Submit Report`;
    return;
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method:  "POST",
      mode:    "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams(payload).toString(),
    });
    document.getElementById("formSuccess").style.display = "flex";
    document.getElementById("reportForm").reset();
    reApplyHidden();
  } catch (err) {
    console.error(err);
    document.getElementById("formError").style.display = "flex";
  }

  btn.disabled = false;
  btn.innerHTML = `<span class="btn-icon">📤</span> Submit Report`;
}

// Re-apply auto-detected hidden values after form reset
function reApplyHidden() {
  if (!detectedData.query) return;
  setVal("rProvider", detectedData.isp      || "");
  setVal("rZip",      detectedData.zip      || "");
  setVal("rIp",       detectedData.query    || "");
  setVal("rIsp",      detectedData.isp      || "");
  setVal("rAsn",      detectedData.as       || "");
  setVal("rRdns",     detectedData.reverse  || "");
  setVal("rCity",     detectedData.city     || "");
  setVal("rState",    detectedData.regionName || "");
}

// Helpers
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
