-- Returns a published workshop offering by slug, plus its sessions.
-- Used by the workshop detail page to fetch offering + sessions in one call.
CREATE OR REPLACE FUNCTION get_offering_with_sessions_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'offering', jsonb_build_object(
      'id', o.id,
      'kind', o.kind,
      'title', o.title,
      'slug', o.slug,
      'description', o.description,
      'pricing_model', o.pricing_model,
      'price_per_participant_vnd', o.price_per_participant_vnd,
      'hourly_rate_vnd', o.hourly_rate_vnd,
      'booking_mode', o.booking_mode,
      'publication_status', o.publication_status,
      'version', o.version
    ),
    'sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'status', s.status,
        'min_participants', s.min_participants,
        'max_participants', s.max_participants,
        'spots_left', LEAST(s.max_participants, s.max_participants) - COALESCE((
          SELECT SUM(b.participant_count)
          FROM bookings b
          WHERE b.session_id = s.id AND b.status IN ('requested', 'confirmed')
        ), 0)
      ) ORDER BY s.starts_at)
      FROM sessions s
      WHERE s.offering_id = o.id
        AND s.status = 'scheduled'
        AND s.starts_at > NOW()
    ), '[]'::jsonb)
  ) INTO result
  FROM offerings o
  WHERE o.slug = p_slug
    AND o.kind = 'workshop'
    AND o.publication_status = 'published';

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_offering_with_sessions_by_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_offering_with_sessions_by_slug(TEXT) TO anon;
