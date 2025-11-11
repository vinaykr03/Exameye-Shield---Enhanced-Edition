import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Upload, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

const DEFAULT_SUBJECTS = [
  { code: "ETCS214A", name: "Data Structure" },
  { code: "ETCS332B", name: "Engineering Mathematics" },
  { code: "ETCS456A", name: "Operating System" },
  { code: "ETCS75A", name: "Theory of Computation" },
  { code: "ETCS852A", name: "Chemistry" },
];

const ExamTemplateUpload = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [subjectType, setSubjectType] = useState<"existing" | "custom">("existing");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [duration, setDuration] = useState<number>(15);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        // Parse and preview immediately
        try {
          const parsedData = await parseExcelFile(selectedFile);
          const processedQuestions = parsedData.map((q: any, index: number) => {
            const hasOptions = q.Question_No || q.Question || q.Option_A || q.Option_B;
            return {
              question_number: q.Question_No || index + 1,
              question_text: q.Question || '',
              question_type: (q.Option_A || q.Option_B) ? 'mcq' : 'short_answer',
              options: (q.Option_A || q.Option_B) ? {
                a: q.Option_A || '',
                b: q.Option_B || '',
                c: q.Option_C || '',
                d: q.Option_D || ''
              } : null,
              correct_answer: q.Correct_Answer || null,
              points: q.Points || 1
            };
          });
          setPreviewQuestions(processedQuestions);
          setShowPreview(true);
        } catch (error) {
          console.error('Error parsing file:', error);
          toast.error("Failed to parse Excel file");
        }
      } else {
        toast.error("Please select an Excel file (.xlsx or .xls)");
      }
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (!file) {
      toast.error("Please select an Excel file");
      return;
    }

    // Validate subject selection
    let subjectCode = "";
    let subjectName = "";
    
    if (subjectType === "existing") {
      if (!selectedSubject) {
        toast.error("Please select a subject");
        return;
      }
      const subject = DEFAULT_SUBJECTS.find(s => s.code === selectedSubject);
      subjectCode = subject!.code;
      subjectName = subject!.name;
    } else {
      if (!customSubjectName.trim() || !customSubjectCode.trim()) {
        toast.error("Please enter both subject name and code");
        return;
      }
      subjectCode = customSubjectCode.trim().toUpperCase();
      subjectName = customSubjectName.trim();
    }

    setLoading(true);

    try {
      // Parse Excel file
      const questions = await parseExcelFile(file);
      
      if (questions.length === 0) {
        toast.error("No questions found in the Excel file");
        setLoading(false);
        return;
      }

      // Create exam template with subject info
      const { data: templateData, error: templateError } = await supabase
        .from('exam_templates')
        .insert({
          template_name: templateName.trim(),
          total_questions: questions.length,
          created_by: 'admin',
          subject_code: subjectCode,
          subject_name: subjectName,
          duration_minutes: duration
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Insert questions - detect MCQ automatically if options exist
      const questionInserts = questions.map((q: any, index: number) => {
        // Check if question has options (MCQ format)
        const hasOptions = q.Option_A || q.Option_B || q.Option_C || q.Option_D;
        const questionType = hasOptions ? 'mcq' : 'short_answer';
        
        return {
          exam_template_id: templateData.id,
          question_number: q.Question_No || index + 1,
          question_text: q.Question || q.question || q.text || '',
          question_type: questionType,
          options: hasOptions ? {
            a: q.Option_A || '',
            b: q.Option_B || '',
            c: q.Option_C || '',
            d: q.Option_D || ''
          } : null,
          correct_answer: q.Correct_Answer || q.correct_answer || null,
          points: q.Points || q.points || 1
        };
      });

      const { error: questionsError } = await supabase
        .from('exam_questions')
        .insert(questionInserts);

      if (questionsError) throw questionsError;

      toast.success(`Template "${templateName}" uploaded with ${questions.length} questions for ${subjectName}!`);
      
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1500);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">ExamEye Shield</h1>
              <p className="text-sm text-muted-foreground">Upload Exam Template</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Upload Exam Template</h2>
              <p className="text-sm text-muted-foreground">
                Upload an Excel file with exam questions (MCQ or Short Answer)
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  placeholder="e.g., Final Exam - Spring 2024"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Exam Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="300"
                  placeholder="15"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
                  required
                />
                <p className="text-xs text-muted-foreground">Default: 15 minutes</p>
              </div>

              {/* Subject Selection */}
              <div className="space-y-4">
                <Label>Subject</Label>
                <div className="flex gap-4 mb-4">
                  <Button
                    type="button"
                    variant={subjectType === "existing" ? "default" : "outline"}
                    onClick={() => setSubjectType("existing")}
                    size="sm"
                  >
                    Select Existing
                  </Button>
                  <Button
                    type="button"
                    variant={subjectType === "custom" ? "default" : "outline"}
                    onClick={() => setSubjectType("custom")}
                    size="sm"
                  >
                    Add Custom
                  </Button>
                </div>

                {subjectType === "existing" ? (
                  <Select value={selectedSubject} onValueChange={setSelectedSubject} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_SUBJECTS.map((subject) => (
                        <SelectItem key={subject.code} value={subject.code}>
                          {subject.name} - {subject.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Subject Name (e.g., Database Management)"
                      value={customSubjectName}
                      onChange={(e) => setCustomSubjectName(e.target.value)}
                      required
                    />
                    <Input
                      placeholder="Subject Code (e.g., ETCS999A)"
                      value={customSubjectCode}
                      onChange={(e) => setCustomSubjectCode(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Excel File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    required
                  />
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                </div>
                {file && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading || previewQuestions.length === 0}>
                <Upload className="w-4 h-4 mr-2" />
                {loading ? "Uploading..." : "Upload Template"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {showPreview && previewQuestions.length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Preview Questions ({previewQuestions.length})</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  Hide Preview
                </Button>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {previewQuestions.map((q, index) => (
                  <Card key={index} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="font-semibold text-primary text-lg">Q{q.question_number}.</span>
                        <div className="flex-1">
                          <p className="font-medium">{q.question_text}</p>
                          <span className="text-xs text-muted-foreground mt-1 inline-block">
                            Type: {q.question_type === 'mcq' ? 'Multiple Choice' : 'Short Answer'} | Points: {q.points}
                          </span>
                        </div>
                      </div>
                      
                      {q.question_type === 'mcq' && q.options && (
                        <div className="ml-8 space-y-2">
                          {Object.entries(q.options).map(([key, value]: [string, any]) => (
                            value && (
                              <div key={key} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                                <span className="font-semibold text-sm uppercase min-w-[20px]">{key})</span>
                                <span className="text-sm">{value}</span>
                              </div>
                            )
                          ))}
                          {q.correct_answer && (
                            <div className="mt-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                Correct Answer: {q.correct_answer}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6 bg-muted/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">Excel Format Guidelines</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5"></div>
                Required columns: Question_No, Question, Option_A, Option_B, Option_C, Option_D
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5"></div>
                For MCQ: Fill all Option_A through Option_D columns with answer choices
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5"></div>
                Optional columns: Correct_Answer, Points (defaults to 1 point per question)
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5"></div>
                Questions with options automatically detected as MCQ, otherwise short answer
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamTemplateUpload;