// Meta Pixel & Conversions API Tracker
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./whatsapp";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-pair`;

// Cookie helper
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 90) {
  if (typeof document === "undefined") return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}

// Generate unique visitor ID
export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let vId = localStorage.getItem("wt_visitor_id");
  if (!vId) {
    vId = "v_" + crypto.randomUUID();
    localStorage.setItem("wt_visitor_id", vId);
  }
  return vId;
}

// Get or generate Meta _fbp (Browser ID)
export function getOrCreateFbp(): string {
  let fbp = getCookie("_fbp");
  if (!fbp && typeof window !== "undefined") {
    fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 8999999999 + 1000000000)}`;
    setCookie("_fbp", fbp);
  }
  return fbp || "";
}

// Get or generate Meta _fbc (Click ID)
export function getOrCreateFbc(fbclid?: string | null): string {
  let fbc = getCookie("_fbc");
  const activeFbclid = fbclid || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("fbclid") : null);
  if (activeFbclid) {
    fbc = `fb.1.${Date.now()}.${activeFbclid}`;
    setCookie("_fbc", fbc);
  }
  return fbc || "";
}

export interface AttributionData {
  visitorId: string;
  promoterId: string;
  fbclid: string;
  fbp: string;
  fbc: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  landingPage: string;
}

// Extract and persist attribution parameters across user journey
export function captureAttribution(): AttributionData {
  if (typeof window === "undefined") {
    return {
      visitorId: "",
      promoterId: "",
      fbclid: "",
      fbp: "",
      fbc: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmContent: "",
      utmTerm: "",
      landingPage: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const visitorId = getOrCreateVisitorId();

  // Promoter / Ref
  const incomingPromoter =
    params.get("promoter") ||
    params.get("promoter_id") ||
    params.get("ref") ||
    params.get("p") ||
    "";
  if (incomingPromoter) {
    localStorage.setItem("wt_promoter_id", incomingPromoter);
  }
  const promoterId = incomingPromoter || localStorage.getItem("wt_promoter_id") || "";

  // fbclid
  const incomingFbclid = params.get("fbclid") || "";
  if (incomingFbclid) {
    localStorage.setItem("wt_fbclid", incomingFbclid);
  }
  const fbclid = incomingFbclid || localStorage.getItem("wt_fbclid") || "";

  // UTM parameters
  const utmSource = params.get("utm_source") || localStorage.getItem("wt_utm_source") || "";
  if (params.get("utm_source")) localStorage.setItem("wt_utm_source", utmSource);

  const utmMedium = params.get("utm_medium") || localStorage.getItem("wt_utm_medium") || "";
  if (params.get("utm_medium")) localStorage.setItem("wt_utm_medium", utmMedium);

  const utmCampaign = params.get("utm_campaign") || localStorage.getItem("wt_utm_campaign") || "";
  if (params.get("utm_campaign")) localStorage.setItem("wt_utm_campaign", utmCampaign);

  const utmContent = params.get("utm_content") || localStorage.getItem("wt_utm_content") || "";
  if (params.get("utm_content")) localStorage.setItem("wt_utm_content", utmContent);

  const utmTerm = params.get("utm_term") || localStorage.getItem("wt_utm_term") || "";
  if (params.get("utm_term")) localStorage.setItem("wt_utm_term", utmTerm);

  const fbp = getOrCreateFbp();
  const fbc = getOrCreateFbc(fbclid);

  return {
    visitorId,
    promoterId,
    fbclid,
    fbp,
    fbc,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    landingPage: window.location.href,
  };
}

// Dynamically inject Meta Pixel base script
export function initMetaPixel(pixelId: string) {
  if (typeof window === "undefined" || !pixelId || pixelId === "123456789012345") return;

  const win = window as any;
  if (win.fbq) {
    // If already initialized, init this specific pixel
    try {
      win.fbq("init", pixelId);
      win.fbq("track", "PageView");
    } catch {}
    return;
  }

  // Standard Meta Pixel snippet
  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  win.fbq("init", pixelId);
  win.fbq("track", "PageView");
  console.log(`[Meta Pixel] Initialized pixel ID: ${pixelId} (PageView tracked)`);
}

// Track Visit on Landing Page
export async function recordVisitSession(): Promise<string> {
  const attribution = captureAttribution();
  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "track_visit",
        ...attribution,
      }),
    });
    const data = await res.json();
    if (data.pixelId) {
      initMetaPixel(data.pixelId);
    }
    return data.visitorId || attribution.visitorId;
  } catch (err) {
    console.error("[Meta Tracker] Visit session recording error:", err);
    return attribution.visitorId;
  }
}

// Fire Meta Conversion Event
// CRITICAL: Call this ONLY when pairing is confirmed connected by the backend!
export async function trackMetaConversion(conversion: {
  eventId: string;
  eventName?: string;
  pixelId?: string;
  value?: number;
  currency?: string;
  isNew?: boolean;
}) {
  if (typeof window === "undefined" || !conversion?.eventId) return;

  const win = window as any;
  const eventId = conversion.eventId;
  const eventName = conversion.eventName || "CompleteRegistration";

  // Prevent duplicate browser firing
  const firedKey = `meta_conv_fired_${eventId}`;
  if (sessionStorage.getItem(firedKey)) {
    console.log(`[Meta Tracker] Event ${eventId} already fired in this session. Skipping duplicate.`);
    return;
  }
  sessionStorage.setItem(firedKey, "true");

  // Fire in browser Meta Pixel if available
  if (win.fbq) {
    try {
      win.fbq(
        "track",
        eventName,
        {
          value: conversion.value || 100,
          currency: conversion.currency || "INR",
          status: "connected",
        },
        { eventID: eventId } // Shared eventID for Meta CAPI deduplication
      );
      console.log(`[Meta Pixel] Conversion fired: ${eventName} (Event ID: ${eventId})`);
    } catch (err) {
      console.error("[Meta Pixel] Error tracking event:", err);
    }
  }

  // Notify backend that browser event fired
  try {
    await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "record_browser_conversion",
        eventId,
      }),
    });
  } catch {}
}
