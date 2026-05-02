-- Phase 20: Card Collection (寶可夢風)
--
-- 設計重點:
-- 1) user_collections          — 每位 user 收集到的卦象 / 塔羅牌(已收 + 重複次數)
-- 2) collection_milestone_configs — admin 可調整的里程碑配置(門檻 + 獎勵)
-- 3) collection_milestones     — user 已領取里程碑紀錄(防重複領)
-- 4) record_card_obtained()    — atomic SQL function:UPSERT 收藏 + 跨閾值自動發 credits
--
-- 寫入時機由 server route 呼叫:
--   - daily(/api/daily, /api/iching/daily)
--   - main divination(/api/divine, /api/tarot)
--   - 其他 iching 占法 routes(yesno / plum-blossom / direction)
--   - admin 手動贈卡(source='admin_grant',不觸發里程碑,防止刷獎)
--
-- 「subkind」是塔羅專用 — 'major' / 'wands' / 'cups' / 'swords' / 'pentacles' —
-- 對應 data/tarot.ts 的 TarotSuit。易經填 NULL。
-- 用 subkind 是為了讓里程碑 SQL function 自給自足,不用 join 外部 deck metadata。

-- ─────────────────────────────────────────────
-- 1. user_collections — 收藏本身
-- ─────────────────────────────────────────────

create table if not exists public.user_collections (
  user_id          uuid not null references auth.users(id) on delete cascade,
  collection_type  text not null check (collection_type in ('iching', 'tarot')),
  card_id          text not null,                 -- iching: '1'..'64'  / tarot: card slug
  card_subkind     text,                          -- tarot 'major'|'wands'|'cups'|'swords'|'pentacles' / iching null
  source           text not null check (source in ('daily', 'main', 'plum_blossom', 'direction', 'yes_no', 'admin_grant')),
  obtain_count     int not null default 1,
  first_obtained_at timestamptz not null default now(),
  last_obtained_at  timestamptz not null default now(),
  primary key (user_id, collection_type, card_id)
);

create index if not exists idx_user_collections_user_type
  on public.user_collections (user_id, collection_type);

create index if not exists idx_user_collections_subkind
  on public.user_collections (user_id, collection_type, card_subkind)
  where card_subkind is not null;

-- ─────────────────────────────────────────────
-- 2. collection_milestone_configs — 里程碑配置(admin 可改)
-- ─────────────────────────────────────────────
--
-- kind 'distinct_count' → 該 type 收齊 threshold 張(distinct card_id)
-- kind 'subkind_full'   → 該 type 在 param=subkind 收齊 threshold 張(塔羅大牌/各花色)

create table if not exists public.collection_milestone_configs (
  id              text primary key,           -- 'iching_25' / 'tarot_major_22' / 'tarot_wands_full'
  collection_type text not null check (collection_type in ('iching', 'tarot')),
  kind            text not null check (kind in ('distinct_count', 'subkind_full')),
  threshold       int not null check (threshold > 0),
  param           text,                       -- subkind_full 才用 (e.g. 'major', 'wands')
  reward_credits  int not null default 0 check (reward_credits >= 0),
  label_zh        text not null,
  label_en        text not null,
  label_ja        text,
  label_ko        text,
  sort_order      int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_milestone_configs_type_active
  on public.collection_milestone_configs (collection_type, active, sort_order);

-- updated_at trigger
create or replace function public.touch_milestone_configs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_milestone_configs_touch on public.collection_milestone_configs;
create trigger trg_milestone_configs_touch
  before update on public.collection_milestone_configs
  for each row execute function public.touch_milestone_configs_updated_at();

-- ─────────────────────────────────────────────
-- 3. collection_milestones — 已領紀錄(防重複領)
-- ─────────────────────────────────────────────

create table if not exists public.collection_milestones (
  user_id        uuid not null references auth.users(id) on delete cascade,
  milestone_id   text not null references public.collection_milestone_configs(id) on delete cascade,
  reward_credits int not null,
  granted_at     timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

create index if not exists idx_milestones_user
  on public.collection_milestones (user_id, granted_at desc);

-- ─────────────────────────────────────────────
-- 4. record_card_obtained() — atomic 收藏 + 自動發里程碑獎勵
-- ─────────────────────────────────────────────
-- 流程:
--   (a) UPSERT user_collections — 新卡 obtain_count=1,舊卡 +1
--   (b) source='admin_grant' 直接 return(不觸發里程碑,避免客服刷獎)
--   (c) 算當下 distinct count
--   (d) 遍歷 active milestone configs:
--       - 已領跳過
--       - distinct_count: 比 v_distinct_count vs threshold
--       - subkind_full:  COUNT(*) WHERE subkind=param vs threshold
--       - 達標就 INSERT collection_milestones + 呼叫 add_credits
--   (e) 回 jsonb:{ is_new, distinct_count, unlocked_milestones[], reward_credits }

create or replace function public.record_card_obtained(
  p_user_id          uuid,
  p_collection_type  text,
  p_card_id          text,
  p_card_subkind     text,
  p_source           text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_new          boolean;
  v_distinct_count  int;
  v_unlocked        jsonb := '[]'::jsonb;
  v_total_credits   int := 0;
  v_m               record;
  v_count           int;
  v_inserted        boolean;
begin
  if p_collection_type not in ('iching', 'tarot') then
    raise exception 'invalid collection_type: %', p_collection_type;
  end if;
  if p_source not in ('daily', 'main', 'plum_blossom', 'direction', 'yes_no', 'admin_grant') then
    raise exception 'invalid source: %', p_source;
  end if;

  -- (a) UPSERT — xmax=0 trick 判定 INSERT vs UPDATE(post-9.5 可靠)
  insert into public.user_collections
    (user_id, collection_type, card_id, card_subkind, source, obtain_count)
  values
    (p_user_id, p_collection_type, p_card_id, p_card_subkind, p_source, 1)
  on conflict (user_id, collection_type, card_id) do update
    set obtain_count = user_collections.obtain_count + 1,
        last_obtained_at = now()
  returning (xmax = 0) into v_is_new;

  -- (c) 算總 distinct count
  select count(*)::int into v_distinct_count
    from public.user_collections
   where user_id = p_user_id
     and collection_type = p_collection_type;

  -- (b) admin_grant 不發獎,直接 return
  if p_source = 'admin_grant' then
    return jsonb_build_object(
      'is_new', v_is_new,
      'distinct_count', v_distinct_count,
      'unlocked_milestones', '[]'::jsonb,
      'reward_credits', 0
    );
  end if;

  -- (d) 遍歷 milestone configs
  for v_m in
    select * from public.collection_milestone_configs
     where collection_type = p_collection_type
       and active = true
     order by sort_order, threshold
  loop
    -- 已領跳過
    if exists (
      select 1 from public.collection_milestones
       where user_id = p_user_id and milestone_id = v_m.id
    ) then
      continue;
    end if;

    -- 算這個 milestone 對應的 count
    if v_m.kind = 'distinct_count' then
      v_count := v_distinct_count;
    elsif v_m.kind = 'subkind_full' then
      select count(*)::int into v_count
        from public.user_collections
       where user_id = p_user_id
         and collection_type = p_collection_type
         and card_subkind = v_m.param;
    else
      v_count := 0;
    end if;

    if v_count >= v_m.threshold then
      insert into public.collection_milestones (user_id, milestone_id, reward_credits)
        values (p_user_id, v_m.id, v_m.reward_credits)
        on conflict do nothing
        returning true into v_inserted;

      if v_inserted then
        v_unlocked := v_unlocked || jsonb_build_object(
          'id', v_m.id,
          'reward_credits', v_m.reward_credits,
          'label_zh', v_m.label_zh,
          'label_en', v_m.label_en
        );
        if v_m.reward_credits > 0 then
          perform public.add_credits(
            p_user_id,
            v_m.reward_credits,
            'collection_milestone',
            null,
            jsonb_build_object('milestone_id', v_m.id)
          );
          v_total_credits := v_total_credits + v_m.reward_credits;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'is_new', v_is_new,
    'distinct_count', v_distinct_count,
    'unlocked_milestones', v_unlocked,
    'reward_credits', v_total_credits
  );
end;
$$;

comment on function public.record_card_obtained(uuid, text, text, text, text) is
  'Atomic 收藏寫入 + 跨閾值自動發里程碑獎勵。回傳 jsonb 含 is_new / distinct_count / unlocked_milestones / reward_credits。';

-- ─────────────────────────────────────────────
-- 5. RLS — user 只看自己;admin 可全看;configs public read + admin manage
-- ─────────────────────────────────────────────

alter table public.user_collections enable row level security;
alter table public.collection_milestone_configs enable row level security;
alter table public.collection_milestones enable row level security;

-- user_collections: SELECT 自己;admin 全看
drop policy if exists "Users can view own collections" on public.user_collections;
create policy "Users can view own collections"
  on public.user_collections for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all collections" on public.user_collections;
create policy "Admins can view all collections"
  on public.user_collections for select
  using (public.is_current_user_admin());

-- 寫入透過 service_role(record_card_obtained 從 server route 呼叫),不開放 client 直寫

-- collection_milestone_configs: 任何人讀 active(顯示進度條需要);admin 全管
drop policy if exists "Public can read active milestone configs" on public.collection_milestone_configs;
create policy "Public can read active milestone configs"
  on public.collection_milestone_configs for select
  using (active = true);

drop policy if exists "Admins can read all milestone configs" on public.collection_milestone_configs;
create policy "Admins can read all milestone configs"
  on public.collection_milestone_configs for select
  using (public.is_current_user_admin());

-- 寫入只透過 service_role(admin API route 用 admin client)

-- collection_milestones: SELECT 自己;admin 全看
drop policy if exists "Users can view own milestones" on public.collection_milestones;
create policy "Users can view own milestones"
  on public.collection_milestones for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all milestones" on public.collection_milestones;
create policy "Admins can view all milestones"
  on public.collection_milestones for select
  using (public.is_current_user_admin());

-- ─────────────────────────────────────────────
-- 6. Seed 預設 milestone configs
-- ─────────────────────────────────────────────

insert into public.collection_milestone_configs
  (id, collection_type, kind, threshold, param, reward_credits,
   label_zh, label_en, label_ja, label_ko, sort_order)
values
  -- 易經 64 卦 4 個里程碑
  ('iching_8',  'iching', 'distinct_count', 8,  null, 10,
   '八卦初成', 'Eight Trigrams', '八卦初成', '팔괘 입문', 10),
  ('iching_25', 'iching', 'distinct_count', 25, null, 30,
   '三分易經', 'A Third of the Hexagrams', '易経の三分の一', '주역의 삼분의 일', 20),
  ('iching_40', 'iching', 'distinct_count', 40, null, 60,
   '六成易經', 'Six-tenths of the Hexagrams', '易経の六割', '주역의 육할', 30),
  ('iching_64', 'iching', 'distinct_count', 64, null, 200,
   '易經大師', 'I Ching Master', '易経マスター', '주역 마스터', 40),

  -- 塔羅 78 張里程碑
  ('tarot_22',        'tarot', 'distinct_count', 22, null, 30,
   '收藏 22 張', '22 Cards Collected', '22枚収集', '22장 수집', 10),
  ('tarot_major_full','tarot', 'subkind_full',   22, 'major', 60,
   '大阿爾克那全收', 'All Major Arcana', '大アルカナ全収', '메이저 아르카나 전체', 20),
  ('tarot_wands',     'tarot', 'subkind_full',   14, 'wands', 30,
   '權杖牌組全收', 'All Wands', '杖の組全収', '완드 전체', 30),
  ('tarot_cups',      'tarot', 'subkind_full',   14, 'cups', 30,
   '聖杯牌組全收', 'All Cups', '聖杯の組全収', '컵 전체', 31),
  ('tarot_swords',    'tarot', 'subkind_full',   14, 'swords', 30,
   '寶劍牌組全收', 'All Swords', '剣の組全収', '소드 전체', 32),
  ('tarot_pentacles', 'tarot', 'subkind_full',   14, 'pentacles', 30,
   '錢幣牌組全收', 'All Pentacles', '金貨の組全収', '펜타클 전체', 33),
  ('tarot_50',        'tarot', 'distinct_count', 50, null, 50,
   '收藏破半', 'Past Halfway', '半分を超える', '절반 돌파', 40),
  ('tarot_78',        'tarot', 'distinct_count', 78, null, 300,
   '塔羅大師', 'Tarot Master', 'タロットマスター', '타로 마스터', 50)
on conflict (id) do nothing;
