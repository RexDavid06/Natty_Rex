export type Role = "TRAINER" | "CLIENT";

export interface User {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  phone: string;
  role: Role;
  avatar: string | null;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Invitation {
  id: string;
  client_id: string;
  client_name: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  is_valid: boolean;
  invite_url: string | null;
}

export interface Client {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  date_of_birth: string | null;
  fitness_goals: string;
  training_notes: string;
  avatar: string | null;
  is_active_client: boolean;
  has_account: boolean;
  invitation: Invitation | null;
  assigned_programs: {
    assignment_id: string;
    program_id: string;
    program_name: string;
    status: string;
  }[];
  created_at: string;
  updated_at: string;
}

export interface ExerciseMedia {
  id: string;
  kind: "VIDEO" | "ANIMATION" | "IMAGE";
  title: string;
  description: string;
  url: string | null;
  external_url: string;
  thumbnail_url: string | null;
  is_preferred: boolean;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  muscle_group_display: string;
  category: string;
  category_display: string;
  description: string;
  instructions: string;
  default_sets: number;
  default_reps: string;
  default_weight: string | null;
  default_rest_seconds: number;
  tempo: string;
  animation_url: string | null;
  media: ExerciseMedia[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  muscle_group: string;
  muscle_group_display: string;
  category: string;
  instructions: string;
  trainer_notes: string;
  sets: number;
  reps: string;
  weight: string | null;
  rest_seconds: number;
  tempo: string;
  order: number;
  media: { id: string | null; kind: string; url: string; thumbnail: string | null } | null;
}

export interface WorkoutSession {
  id: string;
  title: string;
  notes: string;
  order: number;
  exercises: WorkoutExercise[];
  exercise_count: number;
}

export interface WorkoutDay {
  id: string;
  day_of_week: number;
  day_name: string;
  is_rest_day: boolean;
  notes: string;
  sessions: WorkoutSession[];
}

export interface WorkoutWeek {
  id: string;
  week_number: number;
  notes: string;
  days: WorkoutDay[];
}

export interface AssignmentSummary {
  id: string;
  client_id: string;
  client_name: string;
  program_id: string;
  program_name: string;
  status: string;
  assigned_at: string;
  start_date: string | null;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  objective: string;
  objective_display: string;
  start_date: string;
  end_date: string | null;
  weeks_duration: number;
  status: string;
  status_display: string;
  assigned_client_count: number;
  assignments: AssignmentSummary[];
  session_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProgramDetail extends Program {
  weeks: WorkoutWeek[];
}

export interface ProgressEntry {
  id: string;
  date: string;
  weight_kg: string | null;
  body_fat_percentage: string | null;
  measurements: Record<string, string | number>;
  notes: string;
  client_name?: string;
  created_at: string;
}

export interface TrainerNote {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ClientAssignment {
  id: string;
  program: Program;
  status: string;
  assigned_at: string;
  start_date: string | null;
  progress: { total_workouts: number; completed_workouts: number; percentage: number };
}

export interface SessionSummary {
  id: string;
  title: string;
  notes: string;
  week_number: number;
  day_of_week: number;
  program_id: string;
  exercise_count: number;
  scheduled_date: string;
  is_completed: boolean;
  completed_at: string | null;
}

export interface ClientDashboard {
  today: string;
  assignment: ClientAssignment | null;
  week_number?: number;
  today_workout: SessionSummary | null;
  next_workout: SessionSummary | null;
  week: {
    week_number: number;
    total: number;
    completed: number;
    sessions: SessionSummary[];
  } | null;
  overall: { total_workouts: number; completed_workouts: number; percentage: number } | null;
  recent_history: { id: string; title: string; completed_at: string }[];
}

export interface CalendarDay {
  id: string;
  day_of_week: number;
  day_name: string;
  date: string;
  is_rest_day: boolean;
  is_today: boolean;
  notes: string;
  sessions: SessionSummary[];
}

export interface CalendarResponse {
  assignment: ClientAssignment | null;
  week_number: number;
  weeks_duration: number;
  days: CalendarDay[];
}

export interface CompletionInfo {
  completed_at: string;
  actual_sets: number | null;
  actual_reps: string;
  actual_weight: string | null;
  notes: string;
}

export interface ClientWorkoutExercise extends WorkoutExercise {
  is_completed: boolean;
  completion: CompletionInfo | null;
}

export interface ClientSessionDetail {
  id: string;
  title: string;
  notes: string;
  week_number: number;
  day_of_week: number;
  day_name: string;
  date: string;
  program_name: string;
  assignment_id: string;
  exercises: ClientWorkoutExercise[];
  is_completed: boolean;
  completed_at: string | null;
  completed_exercises: number;
  total_exercises: number;
}

export interface TrainerOverview {
  client: Client;
  stats: {
    total_workouts: number;
    completed_workouts: number;
    completion_rate: number;
    current_streak: number;
  };
  assignments: ClientAssignment[];
  history: { id: string; title: string; completed_at: string; notes: string }[];
  progress: ProgressEntry[];
  notes: TrainerNote[];
}

export interface Dashboard {
  stats: {
    active_clients: number;
    new_clients: number;
    workouts_this_week: number;
    completed_this_week: number;
    pending_this_week: number;
    completion_rate: number;
  };
  weekly_chart: { week: string; completed: number }[];
  recent_activity: {
    type: string;
    client_id: string;
    client_name: string;
    title: string;
    at: string;
  }[];
  upcoming: {
    session_id: string;
    client_id: string;
    client_name: string;
    title: string;
    date: string;
    week_number: number;
  }[];
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  kind: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
