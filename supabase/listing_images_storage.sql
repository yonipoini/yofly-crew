-- YoFly Crew - Private listing image storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  false,
  7340032,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 7340032,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload own listing images'
  ) then
    create policy "Users can upload own listing images"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'listing-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own listing images'
  ) then
    create policy "Users can update own listing images"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'listing-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'listing-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can read listing images'
  ) then
    create policy "Authenticated users can read listing images"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'listing-images');
  end if;
end $$;
