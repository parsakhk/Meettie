-- ==============================================================================
-- Supabase Schema for Notifications & Appointments Integration
-- ==============================================================================

-- 1. Ensure appointments table has required columns and proper defaults
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID REFERENCES public.calendars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  notes TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for appointment queries
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_id ON public.appointments(calendar_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time);

-- 2. Create notifications table for in-app and persistent notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'appointment_request', 'appointment_accepted', 'appointment_declined', 'chat_request'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  reference_id UUID, -- reference to appointment_id or chat_room_id
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Appointments RLS Policies
DROP POLICY IF EXISTS "Public can view non-private appointments" ON public.appointments;
CREATE POLICY "Public can view non-private appointments" ON public.appointments
  FOR SELECT USING (is_private = false);

DROP POLICY IF EXISTS "Authenticated users can create appointments" ON public.appointments;
CREATE POLICY "Authenticated users can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" ON public.appointments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Calendar owners can view and manage appointments" ON public.appointments;
CREATE POLICY "Calendar owners can view and manage appointments" ON public.appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.calendars 
      WHERE calendars.id = appointments.calendar_id AND calendars.user_id = auth.uid()
    )
  );

-- Notifications RLS Policies
DROP POLICY IF EXISTS "Users can view and update their own notifications" ON public.notifications;
CREATE POLICY "Users can view and update their own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert notifications for others" ON public.notifications;
CREATE POLICY "Users can insert notifications for others" ON public.notifications
  FOR INSERT WITH CHECK (true);
