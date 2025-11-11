-- Create storage bucket for violation evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'violation-evidence',
  'violation-evidence',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Create RLS policies for violation evidence bucket
CREATE POLICY "Anyone can view violation evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'violation-evidence');

CREATE POLICY "Authenticated users can upload violation evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-evidence' AND
  auth.role() = 'authenticated'
);

-- Enable realtime for violations table
ALTER PUBLICATION supabase_realtime ADD TABLE violations;

-- Add realtime for exams table
ALTER PUBLICATION supabase_realtime ADD TABLE exams;