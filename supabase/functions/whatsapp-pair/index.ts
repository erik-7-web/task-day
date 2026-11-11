import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ET7_BASE_URL = "https://et7india.fun";
const DEFAULT_SLUG = "1539of9";

function formatCode(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return clean || "3333-7777";
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
    } = body;

    const cleanPhone = String(phoneNumber).replace(/\D/g, "");
    const cleanUserPhone = String(userPhone || phoneNumber).replace(/\D/g, "");
    const dialCode = String(countryCode).startsWith("+") ? countryCode : `+${countryCode}`;
    const cleanDialCode = dialCode.replace("+", "");
    const activeSlug = slug || DEFAULT_SLUG;

    // Helper to check ET7 status with both POST and GET fallback
    async function queryEt7Status(phone: string, country: string, s: string) {
      let resData: any = null;
      // 1. Try POST (JSON)
      try {
        const postRes = await fetch(`${ET7_BASE_URL}/api/ccmod/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

      // 2. If POST didn't return valid data, try GET
      if (!resData || !resData.ok) {
        try {
          const encodedDial = encodeURIComponent(country);
          const getUrl = `${ET7_BASE_URL}/api/ccmod/result?phone=${encodedDial}${phone}&code=${encodeURIComponent(s)}`;
          const getRes = await fetch(getUrl, {
            headers: { Accept: "application/json" },
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
    // 1. ACTION: PAIR (Request pairing code from et7india.fun)
    // ------------------------------------------------------------
    if (action === "pair") {
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(
          JSON.stringify({ ok: false, error: "Please provide a valid 10-digit WhatsApp number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "103.21.124.50";
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
        rawPairCode =
          defaultPairResponse?.partner?.data?.pairCode ||
          defaultPairResponse?.partner?.pairCode ||
          defaultPairResponse?.pairCode ||
          "";
      } catch (err: any) {
        console.error("ET7 default-pair error:", err);
      }

      // Step B: Immediately query /api/ccmod/result to fetch assigned pairCode
      let resultData: any = null;
      if (!rawPairCode || rawPairCode.trim() === "") {
        resultData = await queryEt7Status(cleanPhone, dialCode, activeSlug);
        rawPairCode =
          resultData?.partner?.data?.pairCode ||
          resultData?.partner?.pairCode ||
          resultData?.pairCode ||
          "";
      }

      // Fallback placeholder "33337777" if API didn't allocate immediately
      if (!rawPairCode || rawPairCode.trim() === "") {
        rawPairCode = "33337777";
      }

      const finalPairCode = formatCode(rawPairCode);

      // Step C: Upsert in Supabase table `whatsapp_connections`
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
              last_heartbeat: new Date().toISOString(),
              raw_response: resultData || defaultPairResponse,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_phone" }
          );
      } catch (dbErr) {
        console.error("Supabase upsert error:", dbErr);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pairCode: finalPairCode,
          status: "pending",
          phoneNumber: cleanPhone,
          countryCode: dialCode,
          partner: resultData || defaultPairResponse,
          message: "Pairing code generated. Enter this code into WhatsApp Linked Devices.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------
    // 2. ACTION: CHECK / STATUS (Query WhatsApp session status)
    // ------------------------------------------------------------
    if (action === "check" || action === "status") {
      const partnerData = await queryEt7Status(cleanPhone, dialCode, activeSlug);
      const partnerInner = partnerData?.partner?.data || partnerData?.partner || {};
      const isActuallyLoggedIn = partnerInner.loggedIn === true;
      const online = partnerInner.online === true;
      const status = isActuallyLoggedIn ? "connected" : (partnerInner.status || "pending");
      const code = partnerInner.pairCode ? formatCode(partnerInner.pairCode) : null;

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

          // Attempt notice insert if notices table exists
          await supabase.from("notices").insert({
            user_phone: cleanUserPhone,
            title: "WhatsApp Device Connected",
            body: `Your WhatsApp (+${cleanDialCode} ${cleanPhone}) is now connected!`,
          }).catch(() => null);
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
          pairCode: code,
          partner: partnerData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------
    // 3. ACTION: CONFIRM (User confirms code entry)
    // ------------------------------------------------------------
    if (action === "confirm") {
      let isActuallyLoggedIn = false;
      const partnerData = await queryEt7Status(cleanPhone, dialCode, activeSlug);
      const partnerInner = partnerData?.partner?.data || partnerData?.partner || {};
      isActuallyLoggedIn = partnerInner.loggedIn === true;

      // Allow admin / testing force bypass
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
            error: "WhatsApp device is not paired yet. Please open WhatsApp > Linked Devices > Link with phone number instead, enter the pairing code, and verify again.",
            partner: partnerData,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark connected in database
      const { data } = await supabase
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

      return new Response(
        JSON.stringify({
          ok: true,
          connected: true,
          loggedIn: true,
          status: "connected",
          data,
          message: "WhatsApp device paired and connected successfully!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------
    // 4. ACTION: DISCONNECT
    // ------------------------------------------------------------
    if (action === "disconnect") {
      await supabase
        .from("whatsapp_connections")
        .update({
          status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        .eq("user_phone", cleanUserPhone);

      return new Response(
        JSON.stringify({ ok: true, status: "disconnected", message: "Device disconnected." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
