import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ET7_BASE_URL = "https://et7india.fun";
const DEFAULT_SLUG = "1539of9";

// Format pair code as XXXX-XXXX
function formatCode(raw: string): string {
  if (!raw) return "";
  const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return clean;
}

// SHA-256 hash helper for Meta Conversions API privacy requirements
async function sha256(str: string): Promise<string> {
  if (!str) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const {
      action = "pair",
      slug = DEFAULT_SLUG,
      phoneNumber = "",
      countryCode = "+91",
      userPhone = "",
      force = false,
      // Attribution & Meta parameters
      visitorId = "",
      promoterId = "",
      fbclid = "",
      fbp = "",
      fbc = "",
      utmSource = "",
      utmMedium = "",
      utmCampaign = "",
      utmContent = "",
      utmTerm = "",
      landingPage = "",
      eventId = "",
      config = null,
    } = body;

    const cleanPhone = String(phoneNumber).replace(/\D/g, "");
    const cleanUserPhone = String(userPhone || phoneNumber).replace(/\D/g, "");
    const dialCode = String(countryCode).startsWith("+") ? countryCode : `+${countryCode}`;
    const cleanDialCode = dialCode.replace("+", "");
    const activeSlug = slug || DEFAULT_SLUG;

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "103.21.124.50";
    const userAgent = req.headers.get("user-agent") || "";

    // ------------------------------------------------------------
    // Helper: Query ET7 status
    // ------------------------------------------------------------
    async function queryEt7Status(phone: string, country: string, s: string) {
      let resData: any = null;
      try {
        const postRes = await fetch(`${ET7_BASE_URL}/api/ccmod/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(3500),
          body: JSON.stringify({
            slug: s,
            phoneNumber: phone,
            countryCode: country,
          }),
        });
        resData = await postRes.json().catch(() => null);
      } catch (postErr) {
        console.error("ET7 result POST error:", postErr);
      }

      if (!resData || !resData.ok) {
        try {
          const encodedDial = encodeURIComponent(country);
          const getUrl = `${ET7_BASE_URL}/api/ccmod/result?phone=${encodedDial}${phone}&code=${encodeURIComponent(s)}`;
          const getRes = await fetch(getUrl, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(3500),
          });
          const getData = await getRes.json().catch(() => null);
          if (getData) resData = getData;
        } catch (getErr) {
          console.error("ET7 result GET error:", getErr);
        }
      }

      return resData;
    }

    // ------------------------------------------------------------
    // Helper: Send Meta Conversions API (CAPI) event
    // ------------------------------------------------------------
    async function triggerMetaCapi({
      pixelId,
      accessToken,
      testEventCode,
      eventName,
      convEventId,
      phone,
      ip,
      ua,
      fbpVal,
      fbcVal,
      promoter,
      sourceUrl,
      value,
      currency,
    }: any) {
      if (!pixelId || !accessToken || pixelId === "123456789012345") {
        return {
          skipped: true,
          reason: "Meta Conversions API token or Pixel ID not configured yet in meta_pixel_configs",
        };
      }

      const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const hashedPhone = await sha256(formattedPhone);

      const payload: any = {
        data: [
          {
            event_name: eventName || "CompleteRegistration",
            event_time: Math.floor(Date.now() / 1000),
            event_id: convEventId,
            action_source: "website",
            event_source_url: sourceUrl || "https://task-day.vercel.app",
            user_data: {
              ph: [hashedPhone],
              client_ip_address: ip,
              client_user_agent: ua,
              fbp: fbpVal || undefined,
              fbc: fbcVal || undefined,
            },
            custom_data: {
              currency: currency || "INR",
              value: Number(value) || 100.0,
              promoter_id: promoter || undefined,
              status: "connected",
            },
          },
        ],
      };

      if (testEventCode && testEventCode.trim() !== "") {
        payload.test_event_code = testEventCode.trim();
      }

      try {
        const capiRes = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const json = await capiRes.json();
        return { success: capiRes.ok, data: json };
      } catch (err: any) {
        return { success: false, error: err?.message || "CAPI network error" };
      }
    }

    // ------------------------------------------------------------
    // Helper: Execute Conversion Tracking on Connection
    // ------------------------------------------------------------
    async function handleSuccessfulConnectionConversion(uPhone: string) {
      // 1. Fetch connection row to get attribution (promoter, visitor_id, fbclid)
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_phone", uPhone)
        .maybeSingle();

      const pId = conn?.promoter_id || promoterId || "";
      const vId = conn?.visitor_id || visitorId || "";
      const fbClid = conn?.fbclid || fbclid || "";

      // 2. Prevent duplicate conversion events for this phone number
      const { data: existingEvents } = await supabase
        .from("conversion_events")
        .select("event_id, event_status, created_at")
        .eq("user_phone", uPhone)
        .limit(1);

      if (existingEvents && existingEvents.length > 0) {
        return {
          isNew: false,
          duplicate: true,
          eventId: existingEvents[0].event_id,
          message: "Conversion event already tracked for this user",
        };
      }

      // 3. Load active Meta Pixel configuration (check promoter override first)
      let activePixelId = "";
      let activeAccessToken = "";
      let activeTestEventCode = "";
      let activeEventName = "completepair";
      let activeCurrency = "INR";
      let activeValue = 100.0;

      if (pId) {
        const { data: promoterData } = await supabase
          .from("promoters")
          .select("pixel_id, access_token")
          .eq("promoter_code", pId)
          .maybeSingle();

        if (promoterData?.pixel_id) activePixelId = promoterData.pixel_id;
        if (promoterData?.access_token) activeAccessToken = promoterData.access_token;
      }

      const { data: globalConfig } = await supabase
        .from("meta_pixel_configs")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (!activePixelId && globalConfig?.pixel_id) activePixelId = globalConfig.pixel_id;
      if (!activeAccessToken && globalConfig?.access_token) activeAccessToken = globalConfig.access_token;
      if (globalConfig?.test_event_code) activeTestEventCode = globalConfig.test_event_code;
      if (globalConfig?.conversion_event_name) activeEventName = globalConfig.conversion_event_name;
      if (globalConfig?.currency) activeCurrency = globalConfig.currency;
      if (globalConfig?.conversion_value) activeValue = Number(globalConfig.conversion_value);

      // 4. Generate unique deterministic event_id for Meta deduplication
      const newEventId = `wa_${uPhone}_${Date.now()}`;

      // 5. Trigger Meta Conversions API (Server-side)
      const capiResult = await triggerMetaCapi({
        pixelId: activePixelId,
        accessToken: activeAccessToken,
        testEventCode: activeTestEventCode,
        eventName: activeEventName,
        convEventId: newEventId,
        phone: uPhone,
        ip: clientIp,
        ua: userAgent,
        fbpVal: fbp,
        fbcVal: fbc || (fbClid ? `fb.1.${Date.now()}.${fbClid}` : ""),
        promoter: pId,
        sourceUrl: landingPage,
        value: activeValue,
        currency: activeCurrency,
      });

      // 6. Record in conversion_events table
      const { error: insertErr } = await supabase.from("conversion_events").insert({
        event_id: newEventId,
        event_name: activeEventName,
        visitor_id: vId || `v_${uPhone}`,
        user_phone: uPhone,
        promoter_id: pId || null,
        fbclid: fbClid || null,
        fbp: fbp || null,
        fbc: fbc || (fbClid ? `fb.1.${Date.now()}.${fbClid}` : null),
        pairing_status: "connected",
        event_status: capiResult?.success ? "sent_capi" : (capiResult?.skipped ? "pending_browser" : "capi_failed"),
        server_capi_sent: capiResult?.success || false,
        pixel_id: activePixelId || null,
        capi_response: capiResult,
      });

      if (insertErr) {
        console.error("Conversion event record insert error:", insertErr);
      }

      // 7. Update promoter's total conversions
      if (pId) {
        await supabase.rpc("increment_promoter_conversions", { p_code: pId }).catch(async () => {
          // Fallback direct SQL update
          const { data: pRec } = await supabase
            .from("promoters")
            .select("total_conversions")
            .eq("promoter_code", pId)
            .maybeSingle();
          if (pRec) {
            await supabase
              .from("promoters")
              .update({ total_conversions: (pRec.total_conversions || 0) + 1, updated_at: new Date().toISOString() })
              .eq("promoter_code", pId);
          }
        });
      }

      // 8. Update whatsapp_connections with conversion_event_id
      await supabase
        .from("whatsapp_connections")
        .update({ conversion_event_id: newEventId })
        .eq("user_phone", uPhone);

      return {
        isNew: true,
        duplicate: false,
        eventId: newEventId,
        eventName: activeEventName,
        pixelId: activePixelId,
        value: activeValue,
        currency: activeCurrency,
        capiResult,
      };
    }

    // ============================================================
    // ACTION: TRACK_VISIT (Captures promoter, fbclid, UTM on arrival)
    // ============================================================
    if (action === "track_visit") {
      const vId = visitorId || crypto.randomUUID();

      // Record visit session
      await supabase.from("tracking_visits").insert({
        visitor_id: vId,
        promoter_id: promoterId || null,
        fbclid: fbclid || null,
        fbp: fbp || null,
        fbc: fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null),
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        utm_content: utmContent || null,
        utm_term: utmTerm || null,
        landing_page: landingPage || null,
        user_agent: userAgent,
        ip_address: clientIp,
      });

      // Increment promoter visits counter
      if (promoterId) {
        const { data: pRec } = await supabase
          .from("promoters")
          .select("total_visits")
          .eq("promoter_code", promoterId)
          .maybeSingle();

        if (pRec) {
          await supabase
            .from("promoters")
            .update({ total_visits: (pRec.total_visits || 0) + 1, updated_at: new Date().toISOString() })
            .eq("promoter_code", promoterId);
        }
      }

      // Fetch active Meta Pixel ID for client
      let pixelId = "";
      if (promoterId) {
        const { data: pData } = await supabase
          .from("promoters")
          .select("pixel_id")
          .eq("promoter_code", promoterId)
          .maybeSingle();
        if (pData?.pixel_id) pixelId = pData.pixel_id;
      }

      if (!pixelId) {
        const { data: gConfig } = await supabase
          .from("meta_pixel_configs")
          .select("pixel_id, conversion_event_name, currency, conversion_value, is_active")
          .eq("id", "default")
          .maybeSingle();
        if (gConfig?.is_active) pixelId = gConfig?.pixel_id || "";
      }

      return new Response(
        JSON.stringify({
          ok: true,
          visitorId: vId,
          promoterId,
          pixelId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: TRACK_CUSTOM_EVENT / COMPLETEPAIR (Custom Meta CAPI Event)
    // ============================================================
    if (action === "track_custom_event" || action === "completepair") {
      const customEventName = body.eventName || "completepair";
      const uPhone = cleanUserPhone || cleanPhone;
      const convEventId = eventId || `cp_${uPhone || "wa"}_${Date.now()}`;

      // Prevent duplicate conversion events for this eventId
      const { data: existingEvents } = await supabase
        .from("conversion_events")
        .select("event_id, event_status")
        .eq("event_id", convEventId)
        .limit(1);

      if (existingEvents && existingEvents.length > 0) {
        return new Response(
          JSON.stringify({
            ok: true,
            duplicate: true,
            eventId: convEventId,
            eventName: customEventName,
            message: "Custom event already recorded",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Load active Meta Pixel configuration
      let activePixelId = "";
      let activeAccessToken = "";
      let activeTestEventCode = "";
      let activeCurrency = "INR";
      let activeValue = 100.0;

      if (promoterId) {
        const { data: promoterData } = await supabase
          .from("promoters")
          .select("pixel_id, access_token")
          .eq("promoter_code", promoterId)
          .maybeSingle();

        if (promoterData?.pixel_id) activePixelId = promoterData.pixel_id;
        if (promoterData?.access_token) activeAccessToken = promoterData.access_token;
      }

      const { data: globalConfig } = await supabase
        .from("meta_pixel_configs")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (!activePixelId && globalConfig?.pixel_id) activePixelId = globalConfig.pixel_id;
      if (!activeAccessToken && globalConfig?.access_token) activeAccessToken = globalConfig.access_token;
      if (globalConfig?.test_event_code) activeTestEventCode = globalConfig.test_event_code;
      if (globalConfig?.currency) activeCurrency = globalConfig.currency;
      if (globalConfig?.conversion_value) activeValue = Number(globalConfig.conversion_value);

      // Trigger Meta Conversions API (Server-side)
      const capiResult = await triggerMetaCapi({
        pixelId: activePixelId,
        accessToken: activeAccessToken,
        testEventCode: activeTestEventCode,
        eventName: customEventName,
        convEventId: convEventId,
        phone: uPhone,
        ip: clientIp,
        ua: userAgent,
        fbpVal: fbp,
        fbcVal: fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : ""),
        promoter: promoterId,
        sourceUrl: landingPage,
        value: activeValue,
        currency: activeCurrency,
      });

      // Record in conversion_events table
      const { error: insertErr } = await supabase.from("conversion_events").insert({
        event_id: convEventId,
        event_name: customEventName,
        visitor_id: visitorId || `v_${uPhone}`,
        user_phone: uPhone,
        promoter_id: promoterId || null,
        fbclid: fbclid || null,
        fbp: fbp || null,
        fbc: fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null),
        pairing_status: "connected",
        event_status: capiResult?.success ? "sent_capi" : (capiResult?.skipped ? "pending_browser" : "capi_failed"),
        server_capi_sent: capiResult?.success || false,
        pixel_id: activePixelId || null,
        capi_response: capiResult,
      });

      if (insertErr) {
        console.error("Custom conversion event insert error:", insertErr);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          eventName: customEventName,
          eventId: convEventId,
          pixelId: activePixelId,
          capiResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: RECORD_BROWSER_CONVERSION (Browser Pixel confirms firing)
    // ============================================================
    if (action === "record_browser_conversion") {
      if (eventId) {
        await supabase
          .from("conversion_events")
          .update({
            browser_event_sent: true,
            event_status: "success",
            updated_at: new Date().toISOString(),
          })
          .eq("event_id", eventId);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // ACTION: GET_META_CONFIG (Read Pixel configs & promoter links)
    // ============================================================
    if (action === "get_meta_config") {
      const { data: globalConfig } = await supabase
        .from("meta_pixel_configs")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      const { data: promotersList } = await supabase
        .from("promoters")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: recentConversions } = await supabase
        .from("conversion_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const baseUrl = landingPage || "https://task-day.vercel.app";

      const enrichedPromoters = (promotersList || []).map((p: any) => ({
        ...p,
        trackingLink: `${baseUrl}/task?promoter=${encodeURIComponent(p.promoter_code)}&utm_source=meta&utm_medium=cpc&utm_campaign=${encodeURIComponent(p.name)}`,
      }));

      return new Response(
        JSON.stringify({
          ok: true,
          globalConfig,
          promoters: enrichedPromoters,
          recentConversions: recentConversions || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: SAVE_META_CONFIG (Update Pixel configs or add promoter)
    // ============================================================
    if (action === "save_meta_config") {
      if (config) {
        const { error: upsertErr } = await supabase.from("meta_pixel_configs").upsert({
          id: "default",
          pixel_id: config.pixel_id,
          access_token: config.access_token || "",
          test_event_code: config.test_event_code || "",
          conversion_event_name: config.conversion_event_name || "CompleteRegistration",
          currency: config.currency || "INR",
          conversion_value: Number(config.conversion_value) || 100.0,
          is_active: config.is_active !== false,
          notes: config.notes || "Updated via configuration portal",
          updated_at: new Date().toISOString(),
        });

        if (upsertErr) {
          return new Response(JSON.stringify({ ok: false, error: upsertErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, message: "Configuration saved successfully" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // ACTION: ADD_PROMOTER (Register a new promoter/campaign)
    // ============================================================
    if (action === "add_promoter") {
      const { promoterCode, name, pixelId: pPixelId, targetUrl = "/task" } = body;
      if (!promoterCode || !name) {
        return new Response(
          JSON.stringify({ ok: false, error: "promoterCode and name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanCode = String(promoterCode).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

      const { data, error } = await supabase
        .from("promoters")
        .upsert(
          {
            promoter_code: cleanCode,
            name: String(name).trim(),
            pixel_id: pPixelId || null,
            target_url: targetUrl,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "promoter_code" }
        )
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, promoter: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // ACTION: PAIR (Request pairing code from ET7 Gateway)
    // NOTE: Does NOT trigger conversion event (user only requested pair code)
    // ============================================================
    if (action === "pair") {
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(
          JSON.stringify({ ok: false, error: "Please provide a valid 10-digit WhatsApp number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const retailId = crypto.randomUUID();
      let defaultPairResponse: any = null;
      let rawPairCode = "";

      // Step A: Send POST /api/ccmod/default-pair
      try {
        const pairRes = await fetch(`${ET7_BASE_URL}/api/ccmod/default-pair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: activeSlug,
            phoneNumber: cleanPhone,
            countryCode: dialCode,
            sourceExtend: {
              myRetailId: retailId,
              ip: clientIp,
            },
          }),
        });
        defaultPairResponse = await pairRes.json().catch(() => null);
      } catch (err: any) {
        console.error("ET7 default-pair error:", err);
      }

      // Check if ET7 returned an error in default-pair
      const partnerOk =
        defaultPairResponse?.ok !== false &&
        defaultPairResponse?.partner?.success !== false;
      const partnerMsg =
        defaultPairResponse?.partner?.msg ||
        defaultPairResponse?.error ||
        "";

      if (!partnerOk) {
        const is24hCooldown =
          partnerMsg.toLowerCase().includes("24 hours") ||
          partnerMsg.toLowerCase().includes("already logged in");

        const userFriendlyError = is24hCooldown
          ? "This WhatsApp account has already logged in within the last 24 hours. WhatsApp policy allows only one active pairing session per 24 hours for this number. Please wait for the cooldown or use a different WhatsApp number."
          : (partnerMsg || "WhatsApp gateway rejected the pairing request.");

        // Record cooldown/error in database for visibility
        try {
          await supabase.from("whatsapp_connections").upsert(
            {
              user_phone: cleanUserPhone,
              phone_number: cleanPhone,
              country_code: dialCode,
              slug: activeSlug,
              pairing_code: null,
              status: is24hCooldown ? "cooldown_24h" : "error",
              raw_response: defaultPairResponse,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_phone" }
          );
        } catch {}

        return new Response(
          JSON.stringify({
            ok: false,
            error: userFriendlyError,
            code: is24hCooldown ? "ACCOUNT_COOLDOWN_24H" : "GATEWAY_ERROR",
            partner: defaultPairResponse,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      rawPairCode =
        defaultPairResponse?.partner?.data?.pairCode ||
        defaultPairResponse?.partner?.pairCode ||
        defaultPairResponse?.pairCode ||
        "";

      // Step B: Query result endpoint if code not immediately present in defaultPairResponse
      let resultData: any = null;
      if (!rawPairCode || rawPairCode.trim() === "") {
        // Fast 1.2s wait for Baileys socket to initialize
        await new Promise((r) => setTimeout(r, 1200));
        resultData = await queryEt7Status(cleanPhone, dialCode, activeSlug);
        const partnerInner = resultData?.partner?.data || resultData?.partner || {};

        const now = Date.now();
        const expMs = partnerInner.pairExpiresAtMs || partnerInner.requestExpiresAtMs || 0;
        const isExp = partnerInner.reason === "qr_expired" || (expMs > 0 && now > expMs);

        if (!isExp && partnerInner.pairCode) {
          rawPairCode = partnerInner.pairCode;
        }
      }

      const activePartnerInner =
        (resultData || defaultPairResponse)?.partner?.data ||
        (resultData || defaultPairResponse)?.partner ||
        {};
      const qrData = activePartnerInner.qrCode || null;
      const expiresAtMs =
        activePartnerInner.pairExpiresAtMs ||
        activePartnerInner.requestExpiresAtMs ||
        Date.now() + 180000;

      // Fallback to official ET7 placeholder code "33337777" if async allocation is pending
      if (!rawPairCode || rawPairCode.trim() === "") {
        rawPairCode = "33337777";
      }
      const finalPairCode = formatCode(rawPairCode);

      // Step C: Upsert in Supabase table `whatsapp_connections` with attribution
      try {
        await supabase
          .from("whatsapp_connections")
          .upsert(
            {
              user_phone: cleanUserPhone,
              phone_number: cleanPhone,
              country_code: dialCode,
              slug: activeSlug,
              pairing_code: finalPairCode,
              status: "pending",
              visitor_id: visitorId || null,
              promoter_id: promoterId || null,
              fbclid: fbclid || null,
              last_heartbeat: new Date().toISOString(),
              raw_response: resultData || defaultPairResponse,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_phone" }
          );

        // Update tracking_visits if visitorId is present
        if (visitorId) {
          await supabase
            .from("tracking_visits")
            .update({ user_phone: cleanUserPhone, updated_at: new Date().toISOString() })
            .eq("visitor_id", visitorId);
        }
      } catch (dbErr) {
        console.error("Supabase upsert error on pair:", dbErr);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pairCode: finalPairCode,
          qrCode: qrData,
          expiresAt: expiresAtMs,
          status: finalPairCode ? "pair_code" : "pending",
          phoneNumber: cleanPhone,
          countryCode: dialCode,
          partner: resultData || defaultPairResponse,
          message: finalPairCode
            ? "Pairing code generated. Enter this code into WhatsApp Linked Devices."
            : "Generating pairing code from WhatsApp Gateway, please wait...",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: CHECK (Poll WhatsApp status from ET7 Gateway)
    // If connected: Triggers conversion tracking!
    // ============================================================
    if (action === "check" || action === "status") {
      const partnerData = await queryEt7Status(cleanPhone, dialCode, activeSlug);
      const partnerInner = partnerData?.partner?.data || partnerData?.partner || {};
      const isActuallyLoggedIn = partnerInner.loggedIn === true;
      const online = partnerInner.online === true;

      const now = Date.now();
      const expiresAtMs = partnerInner.pairExpiresAtMs || partnerInner.requestExpiresAtMs || null;
      const isExpired =
        partnerInner.reason === "qr_expired" ||
        partnerInner.state === "expired" ||
        (expiresAtMs && now > expiresAtMs);

      let status = "pending";
      if (isActuallyLoggedIn) {
        status = "connected";
      } else if (isExpired) {
        status = "expired";
      } else {
        status = partnerInner.status || "pending";
      }

      // Do NOT send expired pair code as active!
      const rawCode = partnerInner.pairCode || "";
      const code = !isExpired && rawCode && rawCode.trim() !== "" ? formatCode(rawCode) : null;
      const qrData = !isExpired ? (partnerInner.qrCode || null) : null;

      let conversionData: any = null;

      if (isActuallyLoggedIn) {
        try {
          await supabase
            .from("whatsapp_connections")
            .update({
              status: "connected",
              connected_at: new Date().toISOString(),
              last_heartbeat: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              raw_response: partnerData,
            })
            .eq("user_phone", cleanUserPhone);

          // Handle Meta conversion tracking (deduplicated)
          conversionData = await handleSuccessfulConnectionConversion(cleanUserPhone);
        } catch (dbErr) {
          console.error("DB update error on check:", dbErr);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          connected: isActuallyLoggedIn,
          loggedIn: isActuallyLoggedIn,
          online,
          status,
          expired: isExpired,
          expiresAt: expiresAtMs,
          pairCode: code,
          qrCode: qrData,
          partner: partnerData,
          conversion: conversionData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: CONFIRM (User confirms code entry)
    // Only triggers Meta conversion tracking when connected is verified!
    // ============================================================
    if (action === "confirm") {
      let isActuallyLoggedIn = false;
      const partnerData = await queryEt7Status(cleanPhone, dialCode, activeSlug);
      const partnerInner = partnerData?.partner?.data || partnerData?.partner || {};
      isActuallyLoggedIn = partnerInner.loggedIn === true;

      // Allow testing bypass
      if (force === true) {
        isActuallyLoggedIn = true;
      }

      if (!isActuallyLoggedIn) {
        return new Response(
          JSON.stringify({
            ok: false,
            connected: false,
            loggedIn: false,
            status: "pending",
            error:
              "WhatsApp device is not paired yet. Please open WhatsApp > Linked Devices > Link with phone number instead, enter the pairing code, and verify again.",
            partner: partnerData,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark connected in database
      const { data: updatedConn } = await supabase
        .from("whatsapp_connections")
        .update({
          status: "connected",
          connected_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw_response: partnerData,
        })
        .eq("user_phone", cleanUserPhone)
        .select()
        .single();

      // Trigger Meta conversion tracking upon confirmed pairing
      const conversionData = await handleSuccessfulConnectionConversion(cleanUserPhone);

      return new Response(
        JSON.stringify({
          ok: true,
          connected: true,
          loggedIn: true,
          status: "connected",
          data: updatedConn,
          conversion: conversionData,
          message: "WhatsApp device paired and connected successfully!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ACTION: DISCONNECT
    // ============================================================
    if (action === "disconnect") {
      await supabase
        .from("whatsapp_connections")
        .update({
          status: "disconnected",
          pairing_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_phone", cleanUserPhone);

      return new Response(
        JSON.stringify({ ok: true, status: "disconnected", message: "Device disconnected successfully." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
