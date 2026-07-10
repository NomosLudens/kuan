-- Kuan Supabase inspection script.
-- Safe inspection only: SELECT statements; no writes, no DDL, no destructive operation.

-- tabelas Kuan existentes
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and (table_name like 'kuanyin_%' or table_name = 'business_contexts')
order by table_name;

-- constraints Kuan
select
  conname,
  conrelid::regclass as relation_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid::regclass::text like 'public.kuanyin_%'
   or conrelid::regclass::text = 'public.business_contexts'
order by conrelid::regclass::text, conname;

-- indexes Kuan
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and (tablename like 'kuanyin_%' or tablename = 'business_contexts')
order by tablename, indexname;

-- RLS enabled
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and (tablename like 'kuanyin_%' or tablename = 'business_contexts')
order by tablename;

-- policies Kuan
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (tablename like 'kuanyin_%' or tablename = 'business_contexts')
order by tablename, policyname;

-- grants anon/authenticated
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and (table_name like 'kuanyin_%' or table_name = 'business_contexts')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
