
-- Atualiza tabela de custos por feature conforme briefing de cr\u00e9ditos avulsos.
INSERT INTO public.credit_costs (feature_key, cost, label, description, active) VALUES
  ('trip_create_full',     15, 'Criar viagem completa',            'Roteiro completo gerado por IA',         true),
  ('trip_update_ai',        5, 'Atualizar roteiro com IA',         'Ajustes inteligentes em roteiro',         true),
  ('trip_optimize_full',   20, 'Otimizar viagem completa',         'Otimiza��o completa do roteiro',           true),
  ('pdf_generate',          3, 'Gerar PDF',                        'Exporta itiner�rio em PDF',                true),
  ('pdf_translate',         5, 'Traduzir PDF',                     'Traduz PDF para outro idioma',             true),
  ('pdf_edit_smart',        6, 'Editar PDF inteligente',           'Edi��o de PDF com IA',                    true),
  ('scanner_ocr',           5, 'Scanner OCR',                      'Reconhecimento de texto em imagens',      true),
  ('scanner_ocr_translate', 8, 'Scanner + tradu��o autom�tica',    'OCR + tradu��o em uma etapa',             true),
  ('scanner_ocr_advanced', 10, 'OCR avan�ado',                     'OCR de alta precis�o',                    true),
  ('translate_image',       8, 'Traduzir imagem',                  'Tradu��o de imagem por IA',               true),
  ('translate_menu_sign',  10, 'Traduzir card�pio / placa',        'Tradu��o de card�pios, placas e textos',  true),
  ('bt_translate_5min',     5, 'Tradu��o Bluetooth � 5 min',       'Sess�o de 5 minutos ao vivo via Bluetooth', true),
  ('bt_translate_15min',   12, 'Tradu��o Bluetooth � 15 min',      'Sess�o de 15 minutos ao vivo via Bluetooth', true),
  ('bt_translate_30min',   20, 'Tradu��o Bluetooth � 30 min',      'Sess�o de 30 minutos ao vivo via Bluetooth', true),
  ('bt_translate_60min',   35, 'Tradu��o Bluetooth � 60 min',      'Sess�o de 60 minutos ao vivo via Bluetooth', true)
ON CONFLICT (feature_key) DO UPDATE SET
  cost        = EXCLUDED.cost,
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  active      = EXCLUDED.active,
  updated_at  = now();
