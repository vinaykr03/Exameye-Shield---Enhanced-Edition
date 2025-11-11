-- Remove the unique constraint on students.subject_code
-- Multiple students should be able to use the same subject code
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_subject_code_key;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_students_subject_code ON public.students(subject_code);