-- Add media processing columns to daily_standups table
ALTER TABLE public.daily_standups
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_filename TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false;

-- Create storage bucket for daily standups media
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-standups', 'daily-standups', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for daily-standups bucket
CREATE POLICY "Users can upload their own standup media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'daily-standups' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own standup media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'daily-standups' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('manager', 'superadmin')
    )
  )
);

CREATE POLICY "Standup media is publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'daily-standups');

-- Add index for faster processing_status queries
CREATE INDEX IF NOT EXISTS idx_daily_standups_processing_status 
ON public.daily_standups(processing_status) 
WHERE processing_status = 'pending';