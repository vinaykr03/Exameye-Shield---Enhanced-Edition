-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  subject_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exams table
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create violations table
CREATE TABLE IF NOT EXISTS public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('gaze_away', 'multiple_faces', 'no_face', 'phone_detected', 'object_detected', 'tab_switch', 'copy_paste', 'audio_violation')),
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details JSONB,
  image_url TEXT
);

-- Create exam_answers table
CREATE TABLE IF NOT EXISTS public.exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  answer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for students (public read/write for demo purposes)
CREATE POLICY "Anyone can insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Anyone can update students" ON public.students FOR UPDATE USING (true);

-- RLS Policies for exams
CREATE POLICY "Anyone can insert exams" ON public.exams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read exams" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Anyone can update exams" ON public.exams FOR UPDATE USING (true);

-- RLS Policies for violations
CREATE POLICY "Anyone can insert violations" ON public.violations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read violations" ON public.violations FOR SELECT USING (true);

-- RLS Policies for exam_answers
CREATE POLICY "Anyone can insert answers" ON public.exam_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read answers" ON public.exam_answers FOR SELECT USING (true);
CREATE POLICY "Anyone can update answers" ON public.exam_answers FOR UPDATE USING (true);

-- Function to generate unique subject code
CREATE OR REPLACE FUNCTION generate_subject_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code in format: EXAM-XXXXXXXX-XXXXXXXX
    new_code := 'EXAM-' || 
                UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)) || '-' ||
                UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.students WHERE subject_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_subject_code ON public.students(subject_code);
CREATE INDEX IF NOT EXISTS idx_exams_student_id ON public.exams(student_id);
CREATE INDEX IF NOT EXISTS idx_violations_exam_id ON public.violations(exam_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON public.violations(timestamp DESC);