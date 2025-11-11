import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    // Simple password check (in production, use proper authentication)
    setTimeout(() => {
      if (password === "vinay") {
        sessionStorage.setItem('adminAuth', 'true');
        toast.success("Login successful!");
        navigate('/admin/dashboard');
      } else {
        toast.error("Invalid password");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <Shield className="w-7 h-7 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">ExamEye Shield</h1>
              <p className="text-sm text-muted-foreground">Admin Access</p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <Card>
          <CardContent className="p-8">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-secondary" />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
              <p className="text-sm text-muted-foreground">
                Enter password to access monitoring dashboard
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-secondary hover:bg-secondary/90" 
                size="lg"
                disabled={loading}
              >
                {loading ? "Accessing..." : "Access Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="mt-6 bg-secondary/5 border-secondary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold">Secure Access</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Admin access is protected and all activities are logged for security purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
