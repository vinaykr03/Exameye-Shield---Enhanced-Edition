-- Add subject_code to exam_templates table
ALTER TABLE public.exam_templates 
ADD COLUMN subject_code text NOT NULL DEFAULT 'ETCS000A',
ADD COLUMN subject_name text NOT NULL DEFAULT 'General';

-- Create storage buckets for each subject
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('data-structure-etcs214a', 'data-structure-etcs214a', true),
  ('engineering-mathematics-etcs332b', 'engineering-mathematics-etcs332b', true),
  ('operating-system-etcs456a', 'operating-system-etcs456a', true),
  ('theory-of-computation-etcs75a', 'theory-of-computation-etcs75a', true),
  ('chemistry-etcs852a', 'chemistry-etcs852a', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for subject buckets
CREATE POLICY "Anyone can view subject files" 
ON storage.objects FOR SELECT 
USING (bucket_id IN (
  'data-structure-etcs214a',
  'engineering-mathematics-etcs332b', 
  'operating-system-etcs456a',
  'theory-of-computation-etcs75a',
  'chemistry-etcs852a'
));

CREATE POLICY "Anyone can upload subject files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN (
  'data-structure-etcs214a',
  'engineering-mathematics-etcs332b',
  'operating-system-etcs456a', 
  'theory-of-computation-etcs75a',
  'chemistry-etcs852a'
));

-- Update exam_answers table to link to student for better tracking
ALTER TABLE public.exam_answers 
ADD COLUMN student_id uuid REFERENCES public.students(id);

-- Add subject info to violations through exam relationship
-- No changes needed to violations table as it already links to exam_id which links to exam_template_id which now has subject_code

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_exam_templates_subject_code ON public.exam_templates(subject_code);
CREATE INDEX IF NOT EXISTS idx_exam_answers_student_id ON public.exam_answers(student_id);
CREATE INDEX IF NOT EXISTS idx_violations_exam_id ON public.violations(exam_id);