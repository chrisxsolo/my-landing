drop table if exists public.about_photos;
delete from storage.objects where bucket_id = 'about-photos';
delete from storage.buckets where id = 'about-photos';
