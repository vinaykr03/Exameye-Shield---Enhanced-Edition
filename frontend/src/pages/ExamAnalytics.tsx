import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Users, AlertTriangle, Award, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AnalyticsData {
  totalStudents: number;
  totalExams: number;
  completedExams: number;
  avgScore: number;
  passRate: number;
  totalViolations: number;
  violationsByType: { type: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
  questionDifficulty: { question: string; correctRate: number; questionNumber: number }[];
  topViolators: { name: string; studentId: string; violations: number }[];
}

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--secondary))'];

const ExamAnalytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalStudents: 0,
    totalExams: 0,
    completedExams: 0,
    avgScore: 0,
    passRate: 0,
    totalViolations: 0,
    violationsByType: [],
    scoreDistribution: [],
    questionDifficulty: [],
    topViolators: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('adminAuth');
    if (!isAuthenticated) {
      toast.error("Please login as admin");
      navigate('/admin/login');
      return;
    }

    loadAnalytics();
  }, [navigate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all exams with student info
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          *,
          students (
            name,
            student_id,
            email
          )
        `);

      if (examsError) throw examsError;

      // Fetch all violations
      const { data: violationsData, error: violationsError } = await supabase
        .from('violations')
        .select('*');

      if (violationsError) throw violationsError;

      // Fetch all answers for MCQ exams
      const { data: answersData, error: answersError } = await supabase
        .from('exam_answers')
        .select('*');

      if (answersError) throw answersError;

      // Fetch all questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*');

      if (questionsError) throw questionsError;

      // Calculate statistics
      const totalStudents = new Set(examsData?.map(e => e.student_id)).size;
      const totalExams = examsData?.length || 0;
      const completedExams = examsData?.filter(e => e.status === 'completed').length || 0;

      // Calculate scores for MCQ questions
      const scores: number[] = [];
      const examScores = new Map<string, { correct: number; total: number }>();

      examsData?.forEach(exam => {
        if (!exam.exam_template_id) return;

        const examAnswers = answersData?.filter(a => a.exam_id === exam.id) || [];
        const examQuestions = questionsData?.filter(q => q.exam_template_id === exam.exam_template_id && q.question_type === 'mcq') || [];

        if (examQuestions.length === 0) return;

        let correct = 0;
        let total = 0;

        examAnswers.forEach(answer => {
          const question = examQuestions.find(q => q.question_number === answer.question_number);
          if (question && question.question_type === 'mcq') {
            total++;
            if (answer.answer?.trim() === question.correct_answer?.trim()) {
              correct++;
            }
          }
        });

        if (total > 0) {
          const score = Math.round((correct / total) * 100);
          scores.push(score);
          examScores.set(exam.id, { correct, total });
        }
      });

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const passRate = scores.length > 0 ? Math.round((scores.filter(s => s >= 60).length / scores.length) * 100) : 0;

      // Score distribution
      const scoreDistribution = [
        { range: '0-20%', count: scores.filter(s => s >= 0 && s < 20).length },
        { range: '20-40%', count: scores.filter(s => s >= 20 && s < 40).length },
        { range: '40-60%', count: scores.filter(s => s >= 40 && s < 60).length },
        { range: '60-80%', count: scores.filter(s => s >= 60 && s < 80).length },
        { range: '80-100%', count: scores.filter(s => s >= 80 && s <= 100).length },
      ];

      // Violations by type
      const violationCounts: { [key: string]: number } = {};
      violationsData?.forEach(v => {
        violationCounts[v.violation_type] = (violationCounts[v.violation_type] || 0) + 1;
      });

      const violationsByType = Object.entries(violationCounts)
        .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Question difficulty analysis
      const questionStats = new Map<number, { correct: number; total: number; text: string }>();

      examsData?.forEach(exam => {
        if (!exam.exam_template_id) return;

        const examAnswers = answersData?.filter(a => a.exam_id === exam.id) || [];
        const examQuestions = questionsData?.filter(q => q.exam_template_id === exam.exam_template_id && q.question_type === 'mcq') || [];

        examAnswers.forEach(answer => {
          const question = examQuestions.find(q => q.question_number === answer.question_number);
          if (question && question.question_type === 'mcq') {
            const stats = questionStats.get(answer.question_number) || { correct: 0, total: 0, text: question.question_text };
            stats.total++;
            if (answer.answer?.trim() === question.correct_answer?.trim()) {
              stats.correct++;
            }
            questionStats.set(answer.question_number, stats);
          }
        });
      });

      const questionDifficulty = Array.from(questionStats.entries())
        .map(([questionNumber, stats]) => ({
          question: stats.text.substring(0, 50) + (stats.text.length > 50 ? '...' : ''),
          correctRate: Math.round((stats.correct / stats.total) * 100),
          questionNumber,
        }))
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, 10);

      // Top violators
      const violatorMap = new Map<string, { name: string; studentId: string; violations: number }>();
      violationsData?.forEach(v => {
        const exam = examsData?.find(e => e.id === v.exam_id);
        if (exam && exam.students) {
          const key = v.student_id;
          const current = violatorMap.get(key) || { 
            name: exam.students.name, 
            studentId: exam.students.student_id || exam.students.email, 
            violations: 0 
          };
          current.violations++;
          violatorMap.set(key, current);
        }
      });

      const topViolators = Array.from(violatorMap.values())
        .sort((a, b) => b.violations - a.violations)
        .slice(0, 5);

      setAnalytics({
        totalStudents,
        totalExams,
        completedExams,
        avgScore,
        passRate,
        totalViolations: violationsData?.length || 0,
        violationsByType,
        scoreDistribution,
        questionDifficulty,
        topViolators,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error("Failed to load analytics data");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-16 h-16 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Exam Analytics Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Comprehensive performance insights</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadAnalytics}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-3xl font-bold">{analytics.totalStudents}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                  <p className="text-3xl font-bold text-success">{analytics.avgScore}%</p>
                </div>
                <Award className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pass Rate</p>
                  <p className="text-3xl font-bold text-primary">{analytics.passRate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Violations</p>
                  <p className="text-3xl font-bold text-destructive">{analytics.totalViolations}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Score Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Violations by Type */}
          <Card>
            <CardHeader>
              <CardTitle>Top Violation Types</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.violationsByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.violationsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Question Difficulty Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Question Difficulty Analysis (Hardest Questions)</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.questionDifficulty.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No MCQ data available for difficulty analysis</p>
                <p className="text-sm mt-2">Complete some MCQ exams to see question difficulty statistics</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.questionDifficulty} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} label={{ value: 'Correct Rate (%)', position: 'insideBottom', offset: -5 }} />
                  <YAxis type="category" dataKey="questionNumber" label={{ value: 'Question #', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card p-3 border rounded-lg shadow-lg">
                          <p className="font-medium">Q{payload[0].payload.questionNumber}</p>
                          <p className="text-sm text-muted-foreground mb-2">{payload[0].payload.question}</p>
                          <p className="text-sm">Correct Rate: <span className="font-bold">{payload[0].value}%</span></p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="correctRate" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Violators Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Top Violators
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topViolators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No violations recorded yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead className="text-right">Violations</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topViolators.map((violator, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-bold">#{index + 1}</TableCell>
                      <TableCell className="font-medium">{violator.name}</TableCell>
                      <TableCell className="text-muted-foreground">{violator.studentId}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{violator.violations}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {violator.violations > 10 ? (
                          <Badge variant="destructive">Critical</Badge>
                        ) : violator.violations > 5 ? (
                          <Badge variant="outline" className="border-destructive text-destructive">High Risk</Badge>
                        ) : (
                          <Badge variant="secondary">Monitor</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamAnalytics;
