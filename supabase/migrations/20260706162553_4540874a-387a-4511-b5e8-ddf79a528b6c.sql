INSERT INTO public.credit_costs (feature_key, cost, active, label, description)
VALUES ('live_call_video_min', 1, true, 'Chamada de vídeo ao vivo', 'Chamada de vídeo ao vivo (por minuto/participante)')
ON CONFLICT (feature_key) DO NOTHING;