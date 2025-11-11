-- Add duration field to exam_templates table
ALTER TABLE public.exam_templates 
ADD COLUMN duration_minutes integer DEFAULT 15;

COMMENT ON COLUMN public.exam_templates.duration_minutes IS 'Duration of the exam in minutes (default 15)';