-- Supabase Moderation & Safety Schema Updates
-- Supports User Blocking and Content Reporting (Guideline 1.2 compliance)

-- 1. Create User Blocks Table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

-- Enable RLS for User Blocks
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for User Blocks
DROP POLICY IF EXISTS "Users can manage own blocks" ON public.user_blocks;
CREATE POLICY "Users can manage own blocks" 
ON public.user_blocks 
FOR ALL 
TO authenticated 
USING (auth.uid() = blocker_id) 
WITH CHECK (auth.uid() = blocker_id);

-- 2. Create Content Reports Table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('POST', 'COMMENT', 'MESSAGE', 'LISTING')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Content Reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Policies for Content Reports
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.content_reports;
CREATE POLICY "Authenticated users can submit reports" 
ON public.content_reports 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view and manage reports" ON public.content_reports;
CREATE POLICY "Admins can view and manage reports" 
ON public.content_reports 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
