-- Enable the net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "net";

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS "twitter_matches_webhook" ON "public"."matches";
DROP TRIGGER IF EXISTS "twitter_tournaments_webhook" ON "public"."tournaments";

-- Create webhook functions
CREATE OR REPLACE FUNCTION notify_match_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    request_id bigint;
BEGIN
    -- Create the HTTP POST request
    SELECT net.http_post(
        url := 'https://lyjimsetpystcpprjxac.supabase.co/functions/v1/twitter-events',
        body := jsonb_build_object(
            'type', TG_OP,
            'source', 'matches',
            'record', row_to_json(NEW)
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
    ) INTO request_id;

    -- Log the request ID
    RAISE NOTICE 'Webhook request ID: %', request_id;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_tournament_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    request_id bigint;
BEGIN
    -- Create the HTTP POST request
    SELECT net.http_post(
        url := 'https://lyjimsetpystcpprjxac.supabase.co/functions/v1/twitter-events',
        body := jsonb_build_object(
            'type', TG_OP,
            'source', 'tournaments',
            'record', row_to_json(NEW)
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
    ) INTO request_id;

    -- Log the request ID
    RAISE NOTICE 'Webhook request ID: %', request_id;

    RETURN NEW;
END;
$$;

-- Create triggers using the functions
CREATE TRIGGER "twitter_matches_webhook"
AFTER INSERT OR UPDATE ON "public"."matches"
FOR EACH ROW
EXECUTE FUNCTION notify_match_webhook();

CREATE TRIGGER "twitter_tournaments_webhook"
AFTER INSERT ON "public"."tournaments"
FOR EACH ROW
EXECUTE FUNCTION notify_tournament_webhook(); 