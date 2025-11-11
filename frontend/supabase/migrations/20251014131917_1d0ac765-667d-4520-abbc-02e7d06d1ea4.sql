-- Fix the function search path security issue
DROP FUNCTION IF EXISTS generate_subject_code();

CREATE OR REPLACE FUNCTION generate_subject_code()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;