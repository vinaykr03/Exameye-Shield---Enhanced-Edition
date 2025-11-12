import { Shield, User, Lock, Target, Activity, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>ExamEye Shield</h1>
            <p className="text-sm text-muted-foreground font-medium" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Automated Exam Proctoring System</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-6xl font-extrabold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight leading-tight" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
          Secure. Reliable. Intelligent.
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
          AI-powered proctoring system ensuring exam integrity with real-time monitoring, violation detection, and comprehensive analytics.
        </p>
      </section>

      {/* Portal Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Student Portal */}
          <Card className="border-2 hover:border-primary transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-center">Student Portal</h3>
              <p className="text-muted-foreground mb-6 text-center">
                Register and take your proctored exam
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Verification with subject code given by admin
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Face and environment verification before exam
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Real-time AI-powered monitoring
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  Violation detection and alerts
                </li>
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => navigate("/student/register")}
              >
                Student Login
              </Button>
            </CardContent>
          </Card>

          {/* Admin Dashboard */}
          <Card className="border-2 hover:border-secondary transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-8">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-center">Admin Dashboard</h3>
              <p className="text-muted-foreground mb-6 text-center">
                Monitor exams and review violations
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  Real-time student monitoring
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  Violation alerts and tracking
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  Visual analytics dashboard
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                  PDF reports and CSV export
                </li>
              </ul>
              <Button 
                className="w-full bg-secondary hover:bg-secondary/90" 
                size="lg"
                onClick={() => navigate("/admin/login")}
              >
                Admin Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-destructive" />
              </div>
              <h4 className="font-bold mb-2">AI-Powered Detection</h4>
              <p className="text-sm text-muted-foreground">
                Advanced YOLOv8 model for face, object, and behavior detection
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-7 h-7 text-success" />
              </div>
              <h4 className="font-bold mb-2">Real-Time Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Live monitoring dashboard with instant violation alerts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h4 className="font-bold mb-2">Privacy First</h4>
              <p className="text-sm text-muted-foreground">
                All processing on client-side, encrypted data transmission
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;
