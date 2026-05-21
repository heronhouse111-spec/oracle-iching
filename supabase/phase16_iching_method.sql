-- phase16_iching_method.sql
--
-- 為 divinations 表增加兩個欄位,讓不同易經占法可以共用同一張表:
--   method            — 占法名稱(預設 'main',舊資料一律歸入此值)
--   direction_trigram — 方位卦象合參用,記錄第一階段卜得的後天八卦(3-bit 二進位字串)
--                        其他占法此欄為 null
--
-- 也擴充 credit_transactions 的 reason 沒有 enum 限制,所以新加的
-- spend_direction_hex / spend_daily_iching 直接寫入即可,不需要遷移。
--
-- 這支 migration 是純加欄位,完全向後相容。

alter table public.divinations
  add column if not exists method text not null default 'main',
  add column if not exists direction_trigram text;

-- 限定合法值 — 之後新增占法只要再 alter 即可。
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'divinations_method_check'
  ) then
    alter table public.divinations
      add constraint divinations_method_check
      check (method in ('main', 'yesno', 'daily', 'direction-hexagram'));
  end if;
end $$;

-- direction_trigram 僅限 8 種後天八卦的二進位編碼(由下而上)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'divinations_direction_trigram_check'
  ) then
    alter table public.divinations
      add constraint divinations_direction_trigram_check
      check (
        direction_trigram is null
        or direction_trigram in ('111','000','100','010','001','011','101','110')
      );
  end if;
end $$;

-- 方便管理面板查詢「最近的方位卦象合參占卜」用
create index if not exists divinations_method_idx
  on public.divinations (method, created_at desc);
