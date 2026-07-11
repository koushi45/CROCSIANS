-- 既存キャラクターへ一度だけPC版の標準UI配置を適用する。
-- 文字サイズ・BGM・SEを含む他の設定値は変更しない。
UPDATE "CrocsiansSave"
SET "data" = jsonb_set(
  jsonb_set(
    jsonb_set("data"::jsonb, '{expeditionPanelSide}', '"right"'::jsonb, true),
    '{chatPanelSide}', '"left"'::jsonb, true
  ),
  '{pcUiLayoutVersion}', '1'::jsonb, true
);
