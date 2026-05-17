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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calendar_tokens: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          reminder_min: number
          start_hour_activity: number
          start_hour_gym: number
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_min?: number
          id?: string
          reminder_min?: number
          start_hour_activity?: number
          start_hour_gym?: number
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          reminder_min?: number
          start_hour_activity?: number
          start_hour_gym?: number
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_user_id: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_user_id: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_user_id?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      day_completions: {
        Row: {
          completed_at: string
          created_at: string
          day_label: string
          id: string
          rpe: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          day_label: string
          id?: string
          rpe?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          day_label?: string
          id?: string
          rpe?: number | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          alternative_id: string | null
          created_at: string
          exercise_type: string | null
          fatigue_level: string | null
          id: string
          image_url: string | null
          level: number | null
          load_level: string | null
          movement_pattern: string | null
          muscle_group: string | null
          name: string
          priority: number | null
          progression_order: number | null
          recommended_order: number | null
          skill_tag: string | null
          stimulus_type: string | null
          video_url: string | null
        }
        Insert: {
          alternative_id?: string | null
          created_at?: string
          exercise_type?: string | null
          fatigue_level?: string | null
          id?: string
          image_url?: string | null
          level?: number | null
          load_level?: string | null
          movement_pattern?: string | null
          muscle_group?: string | null
          name: string
          priority?: number | null
          progression_order?: number | null
          recommended_order?: number | null
          skill_tag?: string | null
          stimulus_type?: string | null
          video_url?: string | null
        }
        Update: {
          alternative_id?: string | null
          created_at?: string
          exercise_type?: string | null
          fatigue_level?: string | null
          id?: string
          image_url?: string | null
          level?: number | null
          load_level?: string | null
          movement_pattern?: string | null
          muscle_group?: string | null
          name?: string
          priority?: number | null
          progression_order?: number | null
          recommended_order?: number | null
          skill_tag?: string | null
          stimulus_type?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_alternative_id_fkey"
            columns: ["alternative_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      external_activities: {
        Row: {
          category: string
          color: string
          created_at: string
          day_of_week: number
          duration_min: number
          icon: string | null
          id: string
          note: string | null
          start_hour: number
          start_minute: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          day_of_week: number
          duration_min?: number
          icon?: string | null
          id?: string
          note?: string | null
          start_hour?: number
          start_minute?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          day_of_week?: number
          duration_min?: number
          icon?: string | null
          id?: string
          note?: string | null
          start_hour?: number
          start_minute?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          expiry_at: string
          id: string
          last_sync_at: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          expiry_at: string
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          expiry_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          occupation: string | null
          quiz_answers: Json
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          occupation?: string | null
          quiz_answers?: Json
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          occupation?: string | null
          quiz_answers?: Json
          source?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_plan: {
        Row: {
          created_at: string
          id: string
          macros_json: Json
          meals_json: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          macros_json: Json
          meals_json: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          macros_json?: Json
          meals_json?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding: {
        Row: {
          age: number | null
          allergies: string | null
          availability: Json | null
          created_at: string
          equipment_type: string
          goal: string | null
          goal_photo_url: string | null
          height: number | null
          id: string
          initial_tests: Json | null
          injuries: string | null
          intensity_level: number | null
          nutrition_preferences: string | null
          occupation: string | null
          primary_focus: string | null
          sex: string | null
          specific_goal: string | null
          sports: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          age?: number | null
          allergies?: string | null
          availability?: Json | null
          created_at?: string
          equipment_type?: string
          goal?: string | null
          goal_photo_url?: string | null
          height?: number | null
          id?: string
          initial_tests?: Json | null
          injuries?: string | null
          intensity_level?: number | null
          nutrition_preferences?: string | null
          occupation?: string | null
          primary_focus?: string | null
          sex?: string | null
          specific_goal?: string | null
          sports?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          age?: number | null
          allergies?: string | null
          availability?: Json | null
          created_at?: string
          equipment_type?: string
          goal?: string | null
          goal_photo_url?: string | null
          height?: number | null
          id?: string
          initial_tests?: Json | null
          injuries?: string | null
          intensity_level?: number | null
          nutrition_preferences?: string | null
          occupation?: string | null
          primary_focus?: string | null
          sex?: string | null
          specific_goal?: string | null
          sports?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      payment_reminders: {
        Row: {
          body: string
          id: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          id?: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          id?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string
          created_at: string
          estimated_1rm: number | null
          exercise_name: string
          id: string
          reps: number
          user_id: string
          weight: number
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          estimated_1rm?: number | null
          exercise_name: string
          id?: string
          reps: number
          user_id: string
          weight: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          estimated_1rm?: number | null
          exercise_name?: string
          id?: string
          reps?: number
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          payment_status: string
          plan_status: string
          referral_code: string | null
          referred_by: string | null
          stripe_customer_id: string | null
          stripe_payment_id: string | null
          subscription_end: string | null
          subscription_status: string | null
          subscription_tier: string | null
          travel_equipment: string | null
          travel_mode_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          payment_status?: string
          plan_status?: string
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          subscription_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          travel_equipment?: string | null
          travel_mode_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          payment_status?: string
          plan_status?: string
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_payment_id?: string | null
          subscription_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          travel_equipment?: string | null
          travel_mode_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string
          id: string
          note: string | null
          photo_url: string
          taken_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          photo_url: string
          taken_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          photo_url?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_email: string | null
          referred_user_id: string | null
          referrer_user_id: string
          reward_applied: boolean
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
          reward_applied?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
          reward_applied?: boolean
          status?: string
        }
        Relationships: []
      }
      scan_leads: {
        Row: {
          consent: boolean
          created_at: string
          email: string | null
          goal: string
          id: string
          name: string
          result: Json | null
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          consent?: boolean
          created_at?: string
          email?: string | null
          goal: string
          id?: string
          name: string
          result?: Json | null
          user_id?: string | null
          whatsapp: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          email?: string | null
          goal?: string
          id?: string
          name?: string
          result?: Json | null
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          payment_link_live: string | null
          payment_link_test: string | null
          payment_link_yearly_live: string | null
          payment_link_yearly_test: string | null
          payment_mode: string
          price_id_full_live: string | null
          price_id_full_test: string | null
          price_id_live: string | null
          price_id_test: string | null
          price_id_training_live: string | null
          price_id_training_test: string | null
          price_id_transform_live: string | null
          price_id_transform_test: string | null
          price_id_yearly_live: string | null
          price_id_yearly_test: string | null
          referral_coupon_id: string | null
          trainer_bio: string | null
          trainer_name: string | null
          trainer_photo_url: string | null
          updated_at: string
          webhook_secret_live: string | null
          webhook_secret_test: string | null
          yearly_price_eur: number | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          payment_link_live?: string | null
          payment_link_test?: string | null
          payment_link_yearly_live?: string | null
          payment_link_yearly_test?: string | null
          payment_mode?: string
          price_id_full_live?: string | null
          price_id_full_test?: string | null
          price_id_live?: string | null
          price_id_test?: string | null
          price_id_training_live?: string | null
          price_id_training_test?: string | null
          price_id_transform_live?: string | null
          price_id_transform_test?: string | null
          price_id_yearly_live?: string | null
          price_id_yearly_test?: string | null
          referral_coupon_id?: string | null
          trainer_bio?: string | null
          trainer_name?: string | null
          trainer_photo_url?: string | null
          updated_at?: string
          webhook_secret_live?: string | null
          webhook_secret_test?: string | null
          yearly_price_eur?: number | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          payment_link_live?: string | null
          payment_link_test?: string | null
          payment_link_yearly_live?: string | null
          payment_link_yearly_test?: string | null
          payment_mode?: string
          price_id_full_live?: string | null
          price_id_full_test?: string | null
          price_id_live?: string | null
          price_id_test?: string | null
          price_id_training_live?: string | null
          price_id_training_test?: string | null
          price_id_transform_live?: string | null
          price_id_transform_test?: string | null
          price_id_yearly_live?: string | null
          price_id_yearly_test?: string | null
          referral_coupon_id?: string | null
          trainer_bio?: string | null
          trainer_name?: string | null
          trainer_photo_url?: string | null
          updated_at?: string
          webhook_secret_live?: string | null
          webhook_secret_test?: string | null
          yearly_price_eur?: number | null
        }
        Relationships: []
      }
      site_testimonials: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          result: string
          sort_order: number
          text: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          result?: string
          sort_order?: number
          text: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          result?: string
          sort_order?: number
          text?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trainer_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          trainer_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          trainer_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          trainer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trainer_profiles: {
        Row: {
          bio: string
          created_at: string
          display_name: string
          headline: string
          id: string
          photo_url: string
          sort_order: number
          specialty: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          bio?: string
          created_at?: string
          display_name?: string
          headline?: string
          id?: string
          photo_url?: string
          sort_order?: number
          specialty?: string
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          bio?: string
          created_at?: string
          display_name?: string
          headline?: string
          id?: string
          photo_url?: string
          sort_order?: number
          specialty?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      training_plan: {
        Row: {
          created_at: string
          id: string
          updated_at: string | null
          user_id: string
          workouts_json: Json
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string | null
          user_id: string
          workouts_json: Json
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string | null
          user_id?: string
          workouts_json?: Json
        }
        Relationships: []
      }
      training_rules: {
        Row: {
          created_at: string
          id: string
          max_consecutive_high_fatigue: number
          max_heavy_hinges: number
          max_p2_exercises: number
          max_p3_exercises: number
          max_pattern_repeats: number
          max_sets_per_session: number
          min_sets_per_session: number
          push_pull_max_diff: number
          recovery_hours: Json
          reps_fuerza: string
          reps_hipertrofia: string
          reps_isometrico: string
          reps_resistencia: string
          required_patterns: Json
          rest_fuerza: string
          rest_hipertrofia: string
          rest_isometrico: string
          rest_resistencia: string
          series_p1_max: number
          series_p1_min: number
          series_p2_max: number
          series_p2_min: number
          series_p3_max: number
          series_p3_min: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_consecutive_high_fatigue?: number
          max_heavy_hinges?: number
          max_p2_exercises?: number
          max_p3_exercises?: number
          max_pattern_repeats?: number
          max_sets_per_session?: number
          min_sets_per_session?: number
          push_pull_max_diff?: number
          recovery_hours?: Json
          reps_fuerza?: string
          reps_hipertrofia?: string
          reps_isometrico?: string
          reps_resistencia?: string
          required_patterns?: Json
          rest_fuerza?: string
          rest_hipertrofia?: string
          rest_isometrico?: string
          rest_resistencia?: string
          series_p1_max?: number
          series_p1_min?: number
          series_p2_max?: number
          series_p2_min?: number
          series_p3_max?: number
          series_p3_min?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_consecutive_high_fatigue?: number
          max_heavy_hinges?: number
          max_p2_exercises?: number
          max_p3_exercises?: number
          max_pattern_repeats?: number
          max_sets_per_session?: number
          min_sets_per_session?: number
          push_pull_max_diff?: number
          recovery_hours?: Json
          reps_fuerza?: string
          reps_hipertrofia?: string
          reps_isometrico?: string
          reps_resistencia?: string
          required_patterns?: Json
          rest_fuerza?: string
          rest_hipertrofia?: string
          rest_isometrico?: string
          rest_resistencia?: string
          series_p1_max?: number
          series_p1_min?: number
          series_p2_max?: number
          series_p2_min?: number
          series_p3_max?: number
          series_p3_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      training_schedule_overrides: {
        Row: {
          admin_note: string | null
          created_at: string
          day_label: string
          duration_min: number
          id: string
          new_day_of_week: number
          start_hour: number
          start_minute: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          day_label: string
          duration_min?: number
          id?: string
          new_day_of_week: number
          start_hour?: number
          start_minute?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          day_label?: string
          duration_min?: number
          id?: string
          new_day_of_week?: number
          start_hour?: number
          start_minute?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_schedule: {
        Row: {
          busy_blocks: Json
          created_at: string
          gym_slots: Json
          id: string
          meal_duration_min: number
          meal_times: Json
          updated_at: string
          user_id: string
          weekly_reminders: Json
        }
        Insert: {
          busy_blocks?: Json
          created_at?: string
          gym_slots?: Json
          id?: string
          meal_duration_min?: number
          meal_times?: Json
          updated_at?: string
          user_id: string
          weekly_reminders?: Json
        }
        Update: {
          busy_blocks?: Json
          created_at?: string
          gym_slots?: Json
          id?: string
          meal_duration_min?: number
          meal_times?: Json
          updated_at?: string
          user_id?: string
          weekly_reminders?: Json
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          created_at: string
          day_label: string
          exercise_name: string
          id: string
          logged_at: string
          rpe: number | null
          sets_completed: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          day_label: string
          exercise_name: string
          id?: string
          logged_at?: string
          rpe?: number | null
          sets_completed?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          day_label?: string
          exercise_name?: string
          id?: string
          logged_at?: string
          rpe?: number | null
          sets_completed?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_public_stats: {
        Args: never
        Returns: {
          active_count: number
          paid_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trainer_of: {
        Args: { _trainer_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "trainer"
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
    Enums: {
      app_role: ["admin", "user", "trainer"],
    },
  },
} as const
