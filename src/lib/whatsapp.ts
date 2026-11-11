export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://zvjidccwxqbougtqharj.supabase.co";
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2amlkY2N3eHFib3VndHFoYXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MTQxMTMsImV4cCI6MjEwOTk5MDExM30.7rZXV2ve2FzXEYidjRhve8UOBAp5Wo8cD674-Bl8bWQ";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-pair`;

export interface PairResponse {
  ok: boolean;
  pairCode?: string;
  status?: string;
  phoneNumber?: string;
  countryCode?: string;
  partner?: any;
  message?: string;
  error?: string;
}

export interface CheckResponse {
  ok: boolean;
  connected?: boolean;
  loggedIn?: boolean;
  online?: boolean;
  status?: string;
  pairCode?: string | null;
  partner?: any;
  error?: string;
}

export interface ConfirmResponse {
  ok: boolean;
  connected?: boolean;
  loggedIn?: boolean;
  status?: string;
  data?: any;
  message?: string;
  error?: string;
}

export async function requestPairingCode(
  phoneNumber: string,
  countryCode = "+91",
  userPhone?: string
): Promise<PairResponse> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "pair",
      phoneNumber,
      countryCode,
      userPhone: userPhone || phoneNumber,
    }),
  });
  return await res.json();
}

export async function checkWhatsAppStatus(
  phoneNumber: string,
  countryCode = "+91",
  userPhone?: string
): Promise<CheckResponse> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "check",
      phoneNumber,
      countryCode,
      userPhone: userPhone || phoneNumber,
    }),
  });
  return await res.json();
}

export async function confirmWhatsAppPairing(
  phoneNumber: string,
  countryCode = "+91",
  userPhone?: string,
  force = false
): Promise<ConfirmResponse> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action: "confirm",
      phoneNumber,
      countryCode,
      userPhone: userPhone || phoneNumber,
      force,
    }),
  });
  return await res.json();
}
