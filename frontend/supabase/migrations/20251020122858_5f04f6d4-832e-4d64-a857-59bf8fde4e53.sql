-- Create storage bucket for face registrations
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-registrations', 'face-registrations', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for face-registrations bucket
CREATE POLICY "Anyone can view face registrations"
ON storage.objects FOR SELECT
USING (bucket_id = 'face-registrations');

CREATE POLICY "Authenticated users can upload face registrations"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'face-registrations');

-- Add face_image_url to students table
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS face_image_url TEXT;

-- Create exam_questions table for storing questions from Excel
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_template_id UUID,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'short_answer', -- 'mcq' or 'short_answer'
  options JSONB, -- For MCQ options
  correct_answer TEXT, -- For MCQ correct answer
  points INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on exam_questions
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- RLS policies for exam_questions
CREATE POLICY "Anyone can read exam questions"
ON public.exam_questions FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert exam questions"
ON public.exam_questions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update exam questions"
ON public.exam_questions FOR UPDATE
USING (true);

-- Create exam_templates table for organizing question sets
CREATE TABLE IF NOT EXISTS public.exam_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  description TEXT,
  total_questions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by TEXT
);

-- Enable RLS on exam_templates
ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for exam_templates
CREATE POLICY "Anyone can read exam templates"
ON public.exam_templates FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert exam templates"
ON public.exam_templates FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update exam templates"
ON public.exam_templates FOR UPDATE
USING (true);

-- Add exam_template_id to exams table
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS exam_template_id UUID REFERENCES public.exam_templates(id);