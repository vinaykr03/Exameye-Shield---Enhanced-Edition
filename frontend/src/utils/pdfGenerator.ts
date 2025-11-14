import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface ViolationData {
  id: string;
  violation_type: string;
  severity: string;
  timestamp: string;
  image_url?: string;
  details?: any;
}

export class PDFGenerator {
  async generateStudentReport(
    studentName: string,
    studentId: string,
    violations: ViolationData[],
    subjectName?: string,
    subjectCode?: string,
    examScore?: { total_score: number; max_score: number; percentage: number; grade_letter: string }
  ): Promise<string> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Student Exam Report', pageWidth / 2, 20, { align: 'center' });
    
    // Student Info Section
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    let yPos = 40;
    
    pdf.text(`Student ID: ${studentId || 'N/A'}`, 20, yPos);
    yPos += 8;
    pdf.text(`Student Name: ${studentName}`, 20, yPos);
    yPos += 8;
    
    if (subjectName && subjectCode) {
      pdf.text(`Subject: ${subjectName} (${subjectCode})`, 20, yPos);
      yPos += 8;
    }
    
    // Exam Score Section (if available)
    if (examScore) {
      pdf.setFontSize(14);
      pdf.setTextColor(34, 139, 34); // Green color for score
      pdf.text('Exam Results:', 20, yPos);
      yPos += 8;
      
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Score: ${examScore.total_score}/${examScore.max_score} (${examScore.percentage}%)`, 20, yPos);
      yPos += 8;
      pdf.text(`Grade: ${examScore.grade_letter}`, 20, yPos);
      yPos += 10;
    }
    
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
    yPos += 5;
    
    // Separator
    const separatorY = yPos;
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(220, 38, 38);
    pdf.line(20, separatorY, pageWidth - 20, separatorY);
    
    // Summary Section
    pdf.setFontSize(16);
    pdf.text('Summary', 20, separatorY + 13);
    
    pdf.setFontSize(12);
    pdf.text(`Total Violations: ${violations.length}`, 20, separatorY + 23);
    pdf.text(`Report Generated: ${new Date().toLocaleString()}`, 20, separatorY + 31);
    
    // Violation Breakdown
    pdf.setFontSize(14);
    pdf.text('Violation Breakdown', 20, separatorY + 48);
    
    // Count violations by type
    const violationCounts: { [key: string]: number } = {};
    violations.forEach(v => {
      const type = v.violation_type;
      violationCounts[type] = (violationCounts[type] || 0) + 1;
    });
    
    // Table Header
    const tableHeaderY = separatorY + 56;
    pdf.setFontSize(11);
    pdf.setFillColor(220, 38, 38);
    pdf.rect(20, tableHeaderY, pageWidth - 40, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Violation Type', 25, tableHeaderY + 5);
    pdf.text('Count', pageWidth / 2, tableHeaderY + 5);
    pdf.text('Percentage', pageWidth - 60, tableHeaderY + 5);
    
    // Table Rows
    pdf.setTextColor(0, 0, 0);
    let yPos = tableHeaderY + 15;
    Object.entries(violationCounts).forEach(([type, count], index) => {
      const percentage = ((count / violations.length) * 100).toFixed(1);
      
      if (index % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(20, yPos - 5, pageWidth - 40, 8, 'F');
      }
      
      pdf.text(type.replace(/_/g, ' '), 25, yPos);
      pdf.text(count.toString(), pageWidth / 2, yPos);
      pdf.text(`${percentage}%`, pageWidth - 60, yPos);
      
      yPos += 10;
    });
    
    // Detailed Violations with Evidence Images
    if (yPos > 200) {
      pdf.addPage();
      yPos = 20;
    } else {
      yPos += 10;
    }
    
    pdf.setFontSize(14);
    pdf.text('Detailed Violations with Evidence', 20, yPos);
    yPos += 10;
    
    // Include up to 10 violations with images
    const violationsToShow = violations.slice(0, 10);
    
    for (let index = 0; index < violationsToShow.length; index++) {
      const violation = violationsToShow[index];
      
      // Check if we need a new page (accounting for image space)
      if (yPos > 220) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Violation details
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${index + 1}. Violation: ${violation.violation_type.replace(/_/g, ' ').toUpperCase()}`, 25, yPos);
      
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Time: ${new Date(violation.timestamp).toLocaleString()}`, 25, yPos + 6);
      pdf.text(`Severity: ${violation.severity.toUpperCase()}`, 25, yPos + 11);
      
      if (violation.details?.message) {
        pdf.text(`Details: ${violation.details.message}`, 25, yPos + 16);
      }
      
      // Add evidence image if available
      if (violation.image_url) {
        try {
          // Add a small thumbnail with tag
          pdf.setFontSize(8);
          pdf.setTextColor(220, 38, 38);
          pdf.text('📷 Evidence Photo Captured', 25, yPos + 22);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Type: ${violation.violation_type.replace(/_/g, ' ')}`, 25, yPos + 27);
          
          // Note: jsPDF requires image to be loaded first for embedding
          // For now, we'll just reference the URL
          pdf.setFontSize(7);
          pdf.setTextColor(0, 0, 255);
          pdf.textWithLink('View Evidence Image', 25, yPos + 32, { url: violation.image_url });
          
          yPos += 40;
        } catch (error) {
          console.error('Error adding image to PDF:', error);
          yPos += 25;
        }
      } else {
        yPos += 25;
      }
    }
    
    // Footer note about evidence
    pdf.addPage();
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Evidence Images:', 20, 20);
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('All violation evidence images are stored securely in the system.', 20, 28);
    pdf.text('Click on the blue "View Evidence Image" links above to access snapshots.', 20, 34);
    
    let evidenceYPos = 44;
    violations.filter(v => v.image_url).forEach((violation, idx) => {
      if (evidenceYPos > 270) {
        pdf.addPage();
        evidenceYPos = 20;
      }
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${idx + 1}. ${violation.violation_type.replace(/_/g, ' ')}`, 25, evidenceYPos);
      pdf.setTextColor(0, 0, 255);
      pdf.textWithLink('Open Image', 80, evidenceYPos, { url: violation.image_url });
      evidenceYPos += 7;
    });
    
    // Generate PDF blob
    const pdfBlob = pdf.output('blob');
    
    // Upload to Supabase Storage
    const fileName = `${studentName.replace(/\s+/g, '_')}/reports/violation_report_${Date.now()}.pdf`;
    
    const { data, error } = await supabase.storage
      .from('exam-reports')
      .upload(fileName, pdfBlob, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('exam-reports')
      .getPublicUrl(fileName);

    return publicUrl;
  }

  async exportToCSV(violations: ViolationData[]): Promise<string> {
    const headers = ['Timestamp', 'Student Name', 'Violation Type', 'Severity', 'Details', 'Confidence', 'Evidence Image URL', 'Has Evidence'];
    const rows = violations.map(v => [
      new Date(v.timestamp).toLocaleString(),
      v.details?.student_name || 'Unknown Student',
      v.violation_type.replace(/_/g, ' '),
      v.severity,
      v.details?.message || '',
      v.details?.confidence ? `${(v.details.confidence * 100).toFixed(1)}%` : 'N/A',
      v.image_url || 'No evidence captured',
      v.image_url ? 'Yes' : 'No'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }
}

export const pdfGenerator = new PDFGenerator();
