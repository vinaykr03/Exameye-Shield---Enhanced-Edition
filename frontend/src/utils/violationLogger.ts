import { supabase } from '@/integrations/supabase/client';

// Local type definition - no longer using local AI detection
export interface DetectionResult {
  type: 'phone' | 'multiple_person' | 'no_person' | 'object' | 'looking_away' | 'audio_noise';
  confidence: number;
  timestamp: Date;
  bbox?: number[];
}

export interface ViolationLog {
  examId: string;
  studentId: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high';
  details: any;
  imageUrl?: string;
}

export class ViolationLogger {
  async logViolation(violation: ViolationLog) {
    try {
      const { data, error } = await supabase
        .from('violations')
        .insert({
          exam_id: violation.examId,
          student_id: violation.studentId,
          violation_type: violation.violationType,
          severity: violation.severity,
          details: violation.details,
          image_url: violation.imageUrl,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('Violation logged:', data);
      return data;
    } catch (error) {
      console.error('Error logging violation:', error);
      throw error;
    }
  }

  async uploadSnapshot(
    examId: string,
    studentId: string,
    studentName: string,
    imageDataUrl: string,
    violationType: string
  ): Promise<string> {
    try {
      // Convert base64 to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      // Organize by student name
      const sanitizedName = studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const fileName = `${sanitizedName}/${examId}/${violationType}_${timestamp}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('violation-evidence')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('violation-evidence')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading snapshot:', error);
      throw error;
    }
  }

  async logDetectionViolation(
    examId: string,
    studentId: string,
    studentName: string,
    detection: DetectionResult,
    snapshot: string
  ) {
    try {
      // Upload snapshot with student name
      const imageUrl = await this.uploadSnapshot(
        examId,
        studentId,
        studentName,
        snapshot,
        detection.type
      );

      // Determine severity
      const severity = this.determineSeverity(detection.type);

      // Log violation
      await this.logViolation({
        examId,
        studentId,
        violationType: detection.type,
        severity,
        details: {
          confidence: detection.confidence,
          bbox: detection.bbox,
          message: this.getViolationMessage(detection.type)
        },
        imageUrl
      });

      return imageUrl;
    } catch (error) {
      console.error('Error logging detection violation:', error);
      throw error;
    }
  }

  private determineSeverity(type: string): 'low' | 'medium' | 'high' {
    switch (type) {
      case 'phone':
      case 'multiple_person':
        return 'high';
      case 'object':
      case 'no_person':
        return 'medium';
      case 'looking_away':
      case 'audio_noise':
        return 'low';
      default:
        return 'low';
    }
  }

  private getViolationMessage(type: string): string {
    const messages: Record<string, string> = {
      phone: 'Mobile phone detected in exam area',
      multiple_person: 'Multiple persons detected',
      no_person: 'No person detected in frame',
      object: 'Suspicious object detected',
      looking_away: 'Student looking away from screen',
      audio_noise: 'Suspicious audio detected',
      tab_switch: 'Browser tab switched',
      copy_paste: 'Copy/paste detected'
    };
    return messages[type] || 'Violation detected';
  }
}

export const violationLogger = new ViolationLogger();
