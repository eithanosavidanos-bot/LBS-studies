-- Makes an existing account the site owner (admin).
-- 1. Supabase → Authentication → Users → Add user → Create new user
--    (your email + a password, tick "Auto Confirm User").
-- 2. Put that email below, paste into the SQL Editor and Run.
insert into public.profiles (id, name, role)
select id, 'Course owner', 'admin'
from auth.users
where email = 'YOUR-EMAIL@example.com'
on conflict (id) do update set role = 'admin';
