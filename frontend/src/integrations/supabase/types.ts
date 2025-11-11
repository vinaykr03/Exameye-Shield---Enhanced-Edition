export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      exam_answers: {
        Row: {
          answer: string | null
          created_at: string | null
          exam_id: string | null
          id: string
          question_number: number
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          exam_id?: string | null
          id?: string
          question_number: number
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          exam_id?: string | null
          id?: string
          question_number?: number
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: string | null
          created_at: string | null
          exam_template_id: string | null
          id: string
          options: Json | null
          points: number | null
          question_number: number
          question_text: string
          question_type: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string | null
          exam_template_id?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          question_number: number
          question_text: string
          question_type?: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string | null
          exam_template_id?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          question_number?: number
          question_text?: string
          question_type?: string
        }
        Relationships: []
      }
      exam_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          subject_code: string
          subject_name: string
          template_name: string
          total_questions: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          subject_code?: string
          subject_name?: string
          template_name: string
          total_questions?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          subject_code?: string
          subject_name?: string
          template_name?: string
          total_questions?: number | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          exam_template_id: string | null
          id: string
          started_at: string | null
          status: string | null
          student_id: string | null
          subject_code: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          exam_template_id?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          subject_code: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          exam_template_id?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          subject_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_exam_template_id_fkey"
            columns: ["exam_template_id"]
            isOneToOne: false
            referencedRelation: "exam_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          calibrated_pitch: number | null
          calibrated_yaw: number | null
          end_time: string | null
          id: string
          start_time: string | null
          status: string | null
          student_id: string
          student_name: string
          total_frames: number | null
          violation_count: number | null
        }
        Insert: {
          calibrated_pitch?: number | null
          calibrated_yaw?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: string | null
          student_id: string
          student_name: string
          total_frames?: number | null
          violation_count?: number | null
        }
        Update: {
          calibrated_pitch?: number | null
          calibrated_yaw?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: string | null
          student_id?: string
          student_name?: string
          total_frames?: number | null
          violation_count?: number | null
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string | null
          email: string
          face_image_url: string | null
          id: string
          name: string
          registered_at: string | null
          student_id: string | null
          subject_code: string
        }
        Insert: {
          created_at?: string | null
          email: string
          face_image_url?: string | null
          id?: string
          name: string
          registered_at?: string | null
          student_id?: string | null
          subject_code: string
        }
        Update: {
          created_at?: string | null
          email?: string
          face_image_url?: string | null
          id?: string
          name?: string
          registered_at?: string | null
          student_id?: string | null
          subject_code?: string
        }
        Relationships: []
      }
      violations: {
        Row: {
          details: Json | null
          exam_id: string | null
          id: string
          image_url: string | null
          severity: string | null
          student_id: string | null
          timestamp: string | null
          violation_type: string
        }
        Insert: {
          details?: Json | null
          exam_id?: string | null
          id?: string
          image_url?: string | null
          severity?: string | null
          student_id?: string | null
          timestamp?: string | null
          violation_type: string
        }
        Update: {
          details?: Json | null
          exam_id?: string | null
          id?: string
          image_url?: string | null
          severity?: string | null
          student_id?: string | null
          timestamp?: string | null
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_subject_code: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
