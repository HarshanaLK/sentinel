CREATE OR REPLACE FUNCTION delete_expired_telemetry(metric_days integer, log_days integer, span_days integer)
RETURNS TABLE(metrics_deleted bigint, logs_deleted bigint, spans_deleted bigint)
LANGUAGE plpgsql AS $$
DECLARE
    m bigint;
    l bigint;
    s bigint;
BEGIN
    DELETE FROM metric_samples WHERE observed_at < now() - make_interval(days => metric_days);
    GET DIAGNOSTICS m = ROW_COUNT;
    DELETE FROM log_events WHERE observed_at < now() - make_interval(days => log_days);
    GET DIAGNOSTICS l = ROW_COUNT;
    DELETE FROM spans WHERE started_at < now() - make_interval(days => span_days);
    GET DIAGNOSTICS s = ROW_COUNT;
    RETURN QUERY SELECT m, l, s;
END;
$$;
