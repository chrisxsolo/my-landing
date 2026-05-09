alter table public.client_sessions
alter column current_status set default 'inquiry_received';

alter table public.client_sessions
drop constraint if exists client_sessions_current_status_check;

alter table public.client_sessions
add constraint client_sessions_current_status_check check (
  current_status in (
    'inquiry_received',
    'booking_in_progress',
    'booked',
    'session_completed',
    'photos_backed_up',
    'culling',
    'editing',
    'final_review',
    'delivered'
  )
);
