import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import StudentRegister from "./pages/StudentRegister";
import StudentVerify from "./pages/StudentVerify";
import StudentExam from "./pages/StudentExam";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMonitor from "./pages/AdminMonitor";
import NotFound from "./pages/NotFound";
import ExamTemplateUpload from "./pages/ExamTemplateUpload";
import StudentReport from "./pages/StudentReport";
import ExamAnalytics from "./pages/ExamAnalytics";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/student/register" element={<StudentRegister />} />
        <Route path="/student/verify" element={<StudentVerify />} />
        <Route path="/student/exam" element={<StudentExam />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/monitor" element={<AdminMonitor />} />
        <Route path="/admin/upload-template" element={<ExamTemplateUpload />} />
        <Route path="/admin/student-report" element={<StudentReport />} />
        <Route path="/admin/analytics" element={<ExamAnalytics />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
