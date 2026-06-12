-- Expect ok = true on every row.
select 'table' as check, count(*) = 1 as ok
from information_schema.tables
where table_schema = 'public' and table_name = 'about_photos'
union all
select 'unique_slug', count(*) >= 1
from pg_indexes
where schemaname = 'public' and tablename = 'about_photos' and indexdef ilike '%unique%fact_slug%'
union all
select 'bucket', count(*) = 1
from storage.buckets
where id = 'about-photos' and public = true;
