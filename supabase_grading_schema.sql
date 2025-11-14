-- =====================================================
-- PART 2: ADD GRADING COLUMNS TO QUESTIONS TABLE
-- =====================================================

-- Add correct_answer and points columns to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS correct_answer VARCHAR(1) CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN questions.correct_answer IS 'The correct answer option (A, B, C, or D)';
COMMENT ON COLUMN questions.points IS 'Points awarded for this question (default: 1)';

-- =====================================================
-- PART 3: ADD MARKS AND SCORE TO EXAMS TABLE
-- =====================================================

-- Add score tracking to exams table
ALTER TABLE exams
ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS graded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN exams.total_score IS 'Total score earned by student';
COMMENT ON COLUMN exams.max_score IS 'Maximum possible score for the exam';
COMMENT ON COLUMN exams.graded IS 'Whether the exam has been graded';
COMMENT ON COLUMN exams.graded_at IS 'Timestamp when exam was graded';

-- =====================================================
-- PART 3: ADD FACE IMAGE TO STUDENTS TABLE (IF NOT EXISTS)
-- =====================================================

-- Add face_image_url to students table (for registration photo)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS face_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN students.face_image_url IS 'URL to student face image from registration';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index on exam grading status
CREATE INDEX IF NOT EXISTS idx_exams_graded ON exams(graded);

-- Index on student face images
CREATE INDEX IF NOT EXISTS idx_students_face_image ON students(face_image_url) WHERE face_image_url IS NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary:
-- 1. questions table: Added correct_answer (A/B/C/D), points (default 1)
-- 2. exams table: Added total_score, max_score, graded, graded_at
-- 3. students table: Added face_image_url
-- 4. Created performance indexes

SELECT 'Schema migration completed successfully!' AS status;
