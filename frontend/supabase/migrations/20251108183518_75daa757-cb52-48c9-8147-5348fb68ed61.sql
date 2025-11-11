-- Create a storage bucket for PDF reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-reports', 'exam-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the exam-reports bucket
CREATE POLICY "Anyone can upload reports"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'exam-reports');

CREATE POLICY "Reports are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exam-reports');

CREATE POLICY "Anyone can update reports"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'exam-reports');
