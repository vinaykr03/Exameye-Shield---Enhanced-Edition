import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, AlertTriangle, Users, ArrowLeft, RefreshCw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ActiveExam {
  id: string;
  student_id: string;
  subject_code: string;
  status: string;
  started_at: string;
  students: {
    name: string;
    email: string;
    student_id: string;
    face_image_url: string | null;
  };
  exam_templates: {
    subject_name: string;
    subject_code: string;
  };
  violation_count?: number;
  last_activity?: string;
}

const AdminMonitor = () => {
  const navigate = useNavigate();
  const [activeExams, setActiveExams] = useState<ActiveExam[]>([]);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('adminAuth');
    if (!isAuthenticated) {
      toast.error("Please login as admin");
      navigate('/admin/login');
      return;
    }

    loadActiveExams();
    loadRecentViolations();

    // Set up real-time subscriptions
    const examsChannel = supabase
      .channel('active-exams-monitor')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'exams' },
        (payload) => {
          console.log('Exam update:', payload);
          loadActiveExams();
        }
      )
      .subscribe();

    const violationsChannel = supabase
      .channel('violations-monitor')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'violations' },
        (payload) => {
          console.log('New violation:', payload);
          toast.error(`New violation detected!`, {
            description: payload.new.violation_type?.replace(/_/g, ' '),
          });
          loadActiveExams();
          loadRecentViolations();
        }
      )
      .subscribe();

    const interval = setInterval(loadActiveExams, 5000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(examsChannel);
      supabase.removeChannel(violationsChannel);
    };
  }, [navigate]);

  const loadActiveExams = async () => {
    try {
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          *,
          students (
            name,
            email,
            student_id,
            face_image_url
          ),
          exam_templates (
            subject_name,
            subject_code
          )
        `)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false });

      if (examsError) throw examsError;

      // Get violation counts for each active exam
      const examsWithViolations = await Promise.all(
        (examsData || []).map(async (exam) => {
          const { count } = await supabase
            .from('violations')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', exam.id);

          return {
            ...exam,
            violation_count: count || 0,
            last_activity: new Date().toISOString(),
          };
        })
      );

      setActiveExams(examsWithViolations);
      setLoading(false);
    } catch (error) {
      console.error('Error loading active exams:', error);
      toast.error("Failed to load active exams");
      setLoading(false);
    }
  };

  const loadRecentViolations = async () => {
    try {
      // Fetch violations directly without requiring joins (allows NULL foreign keys)
      const { data } = await supabase
        .from('violations')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      setRecentViolations(data || []);
    } catch (error) {
      console.error('Error loading violations:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ${diffMinutes % 60}m ago`;
  };

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'bg-success';
    if (count <= 3) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Real-Time Exam Monitor</h1>
              <p className="text-sm text-muted-foreground">Live view of active exams</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadActiveExams}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Exams</p>
                  <p className="text-3xl font-bold text-success">{activeExams.length}</p>
                </div>
                <Users className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Violations</p>
                  <p className="text-3xl font-bold text-destructive">
                    {activeExams.reduce((sum, exam) => sum + (exam.violation_count || 0), 0)}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Students Monitored</p>
                  <p className="text-3xl font-bold text-primary">{activeExams.length}</p>
                </div>
                <Camera className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Exams Grid */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Live Student Feeds
              </CardTitle>
              <Badge variant="secondary">
                {activeExams.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading active exams...
              </div>
            ) : activeExams.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Active Exams</p>
                <p className="text-sm">Students will appear here when they start their exams</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeExams.map((exam) => (
                  <Card key={exam.id} className="border-2 hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      {/* Student Face Image */}
                      <div className="aspect-video bg-muted rounded-lg mb-4 overflow-hidden relative group">
                        {exam.students.face_image_url ? (
                          <>
                            <img 
                              src={exam.students.face_image_url}
                              alt={exam.students.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="destructive" className="animate-pulse">
                                LIVE
                              </Badge>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="w-16 h-16 text-muted-foreground opacity-50" />
                          </div>
                        )}
                      </div>

                      {/* Student Info */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg">{exam.students.name}</h3>
                            <p className="text-sm text-muted-foreground">{exam.students.student_id}</p>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${getSeverityColor(exam.violation_count || 0)} animate-pulse`}></div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <p><span className="font-medium">Subject:</span> {exam.exam_templates?.subject_name}</p>
                          <p><span className="font-medium">Code:</span> {exam.exam_templates?.subject_code}</p>
                          <p><span className="font-medium">Started:</span> {formatTime(exam.started_at)}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-4 h-4 ${exam.violation_count && exam.violation_count > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-medium ${exam.violation_count && exam.violation_count > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {exam.violation_count || 0} Violations
                            </span>
                          </div>
                          <Badge variant={exam.violation_count && exam.violation_count > 3 ? "destructive" : "secondary"}>
                            {exam.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Violations Alert Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Recent Violations (Live)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentViolations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No recent violations detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentViolations.slice(0, 5).map((violation) => (
                  <div key={violation.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50">
                    {/* Violation Snapshot */}
                    {violation.image_url && (
                      <div className="w-24 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={violation.image_url} 
                          alt="Violation evidence"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Violation Details */}
                    <div className="flex-1 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive mt-1" />
                        <div>
                          <p className="font-medium">
                            {violation.details?.student_name || 'Unknown Student'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {violation.violation_type?.replace(/_/g, ' ')}
                          </p>
                          {violation.details?.message && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {violation.details.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="mb-1">
                          {violation.severity}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(violation.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMonitor;
