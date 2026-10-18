/* ===================================================
   app.js — WhoIsMyProvider
   ===================================================
   Detects visitor's IP, RDNS hostname, ISP, ASN,
   maps them to legacy cable provider (TWC, Charter, Cox, etc.),
   and automatically logs visitor details silently.
   =================================================== */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwG2wNJkiT7YhxOw4_dZyqAaWAAludrR84O9QuU16N0GSSY8_K9KS5MqMXPsXKdMWN/exec";

// ─────────────────────────────────────────────────────
// PROVIDER DATABASE
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
    description: "Your connection is identified as Spectrum — the unified brand used by Charter Communications after merging with Time Warner Cable, Bright House Networks, and Cox."
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
    description: "Your connection is on the Comcast network, which operates under the Xfinity brand for residential service."
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
    description: "Your connection is on the Verizon network."
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
    description: "Your connection is on the AT&T network."
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
    description: "Your connection is on the T-Mobile network."
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
    description: "Your connection is on WideOpenWest (WOW!)."
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
    description: "Your connection is on the Suddenlink / Optimum network."
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
    description: "Your connection is on the Mediacom network."
  }
];

const UNKNOWN_PROVIDER = {
  key: "other", name: "Unknown / Other Provider",
  subName: "Could not identify legacy brand",
  badge: "Other ISP", logo: "❓",
  bannerClass: "banner-other",
  description: "We were unable to match your connection to a known provider in our database. Your raw ISP name and ASN are shown above."
};

// ─────────────────────────────────────────────────────
// MAIN LOOKUP
// ─────────────────────────────────────────────────────
async function runLookup() {
  const btn = document.getElementById("checkBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Looking up…`;

  document.getElementById("spinner").style.display = "flex";
  document.getElementById("results").style.display = "none";

  try {
    const ipData = await fetchIpData();
    const provider = detectProvider(ipData);
    renderResults(ipData, provider);

    // Automatically & silently log visitor in background
    autoLogVisit(ipData, provider);

    document.getElementById("spinner").style.display = "none";
    document.getElementById("results").style.display = "block";
    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Lookup error:", err);
    document.getElementById("spinner").style.display = "none";
    alert("⚠️ Could not look up your connection details. If you have an ad blocker or strict tracker protection enabled, try temporarily allowing this page.");
  }

  btn.disabled = false;
  btn.innerHTML = `<span class="btn-icon">🔍</span> Look Up My Connection`;
}

// ─────────────────────────────────────────────────────
// ROBUST MULTI-PROVIDER IP FETCH (All HTTPS, Adblock-Resistant)
// ─────────────────────────────────────────────────────
async function fetchIpData() {
  let normalized = null;

  // 1. Try ipwho.is
  try {
    const res = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        const conn = data.connection || {};
        const asnNum = conn.asn || "";
        const isp = conn.isp || conn.org || "";
        normalized = {
          query:      data.ip || "",
          isp:        isp,
          org:        conn.org || isp,
          as:         asnNum ? `AS${asnNum} ${isp}` : "",
          asname:     isp,
          reverse:    "",
          city:       data.city || "",
          regionName: data.region || "",
          zip:        data.postal || "",
          country:    data.country || "",
          timezone:   (data.timezone && data.timezone.id) || "",
          mobile:     false,
          proxy:      false,
        };
      }
    }
  } catch (e) {
    console.warn("ipwho.is failed, trying backup...", e);
  }

  // 2. Try ipapi.co if not resolved yet
  if (!normalized) {
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error && data.ip) {
          const asnNum = (data.asn || "").replace(/^AS/i, "");
          normalized = {
            query:      data.ip,
            isp:        data.org || data.asn || "",
            org:        data.org || "",
            as:         data.asn || "",
            asname:     data.org || "",
            reverse:    "",
            city:       data.city || "",
            regionName: data.region || "",
            zip:        data.postal || "",
            country:    data.country_name || "",
            timezone:   data.timezone || "",
            mobile:     false,
            proxy:      false,
          };
        }
      }
    } catch (e) {
      console.warn("ipapi.co failed, trying ipify + cloudflare...", e);
    }
  }

  // 3. Last fallback: api.ipify.org
  if (!normalized) {
    const res = await fetch("https://api.ipify.org?format=json");
    const json = await res.json();
    if (!json || !json.ip) throw new Error("Could not detect IP address");

    // Once we have IP, query details
    try {
      const detailRes = await fetch(`https://ipapi.co/${json.ip}/json/`);
      const data = await detailRes.json();
      normalized = {
        query:      json.ip,
        isp:        data.org || "Broadband Provider",
        org:        data.org || "",
        as:         data.asn || "",
        asname:     data.org || "",
        reverse:    "",
        city:       data.city || "",
        regionName: data.region || "",
        zip:        data.postal || "",
        country:    data.country_name || "",
        timezone:   data.timezone || "",
        mobile:     false,
        proxy:      false,
      };
    } catch (err) {
      normalized = {
        query: json.ip,
        isp: "Detected",
        org: "",
        as: "",
        asname: "",
        reverse: "",
        city: "Unknown",
        regionName: "",
        zip: "",
        country: "",
        timezone: "",
        mobile: false,
        proxy: false
      };
    }
  }

  // Fetch Reverse DNS via Google DNS
  try {
    normalized.reverse = await fetchRdns(normalized.query);
  } catch (e) {
    normalized.reverse = "";
  }

  return normalized;
}

// ─────────────────────────────────────────────────────
// REVERSE DNS LOOKUP VIA GOOGLE DNS-OVER-HTTPS
// ─────────────────────────────────────────────────────
async function fetchRdns(ip) {
  if (!ip) return "";
  const reversed = ip.split(".").reverse().join(".") + ".in-addr.arpa";
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(reversed)}&type=PTR`, {
    headers: { Accept: "application/json" }
  });
  const json = await res.json();
  if (json.Answer && json.Answer.length > 0) {
    return json.Answer[0].data.replace(/\.$/, "");
  }
  return "";
}

// ─────────────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────────────
function renderResults(d, provider) {
  const banner = document.getElementById("providerBanner");
  banner.className = "provider-banner " + provider.bannerClass;
  document.getElementById("providerLogo").textContent  = provider.logo;
  document.getElementById("providerName").textContent  = provider.name;
  document.getElementById("providerSub").textContent   = provider.subName;
  document.getElementById("providerBadge").textContent = provider.badge;

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

  let connType = "Residential Broadband";
  if (d.mobile) connType = "📱 Mobile / Cellular";
  set("dType", connType);

  if (d.proxy) {
    set("dProxy", "⚠️ VPN or Proxy Detected");
    document.getElementById("dProxy").style.color = "var(--warning)";
  } else {
    set("dProxy", "✅ Direct Connection");
    document.getElementById("dProxy").style.color = "var(--green)";
  }

  document.getElementById("explainIcon").textContent  = provider.logo;
  document.getElementById("explainTitle").textContent = provider.name + " Detected";
  document.getElementById("explainDesc").textContent  = provider.description;
}

// ─────────────────────────────────────────────────────
// PROVIDER DETECTION ENGINE
// ─────────────────────────────────────────────────────
function detectProvider(d) {
  const asnRaw = (d.as      || "").toLowerCase();
  const isp    = (d.isp     || "").toLowerCase();
  const org    = (d.org     || "").toLowerCase();
  const rdns   = (d.reverse || "").toLowerCase();
  const asname = (d.asname  || "").toLowerCase();
  const asnNum = asnRaw.replace(/^as/i, "").split(" ")[0];

  for (const p of PROVIDERS) {
    if (p.asnList.includes(asnNum)) return p;
    const allText = [isp, org, asname].join(" ");
    if (p.ispKeywords.some(kw => allText.includes(kw))) return p;
    if (rdns && p.rdnsPatterns.some(pat => rdns.includes(pat))) return p;
  }

  return UNKNOWN_PROVIDER;
}

// ─────────────────────────────────────────────────────
// AUTOMATIC BACKGROUND VISIT LOGGING
// Sends IP, location, legacy provider, and timestamp to Google Sheet
// ─────────────────────────────────────────────────────
async function autoLogVisit(d, provider) {
  if (!GOOGLE_SCRIPT_URL) return;

  const payload = {
    timestamp: new Date().toISOString(),
    name:      "Auto-Logged Visitor",
    email:     "",
    zip:       d.zip || "",
    legacy:    provider.badge || provider.name,
    isp:       d.isp || "",
    asn:       d.as || "",
    rdns:      d.reverse || "",
    status:    "Visited & Looked Up",
    notes:     `Provider: ${provider.name} | City: ${d.city || "Unknown"}, ${d.regionName || ""}`,
    ip:        d.query || "",
    city:      d.city || "",
    state:     d.regionName || "",
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });
    console.log("Visitor auto-logged successfully.");
  } catch (err) {
    console.warn("Background log skipped:", err);
  }
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
