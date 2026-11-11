# ET7 WhatsApp pairing migration
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_phone TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT '+91',
    slug TEXT NOT NULL DEFAULT '1539of9',
    pairing_code TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, connected, disconnected
    rate_per_hour NUMERIC DEFAULT 2.00,
    total_earned NUMERIC DEFAULT 0.00,
    connected_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ DEFAULT now(),
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.whatsapp_connections
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON public.whatsapp_connections
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON public.whatsapp_connections
    FOR UPDATE USING (true);
