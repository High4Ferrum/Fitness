export type Role = 'admin' | 'coach' | 'client';
export interface User { id: string; name: string; email: string; role: Role; clientId?: string; }
export interface Exercise { id: string; name: string; category: string; muscles: string; equipment: string[]; difficulty: string; instructions: string; cues: string; videoUrl: string; alternatives: string[]; archived: boolean; references?: { name: string; url: string }[]; }
export interface Client { id: string; userId: string; coachId: string; name: string; email: string; goal: string; equipment: string[]; color: string; joinedAt: string; }
export interface PlanItem { exerciseId: string; sets: number; reps: number; weight: number; rest: number; notes: string; }
export interface Plan { id: string; clientId: string; name: string; date: string; items: PlanItem[]; notes: string; weeklyAssignmentId?: string; }
export interface WorkoutTemplate { id: string; ownerId: string; name: string; items: PlanItem[]; notes: string; }
export interface WeeklyLineupDay { weekday: number; templateId: string; }
export interface WeeklyLineup { id: string; ownerId: string; name: string; notes: string; days: WeeklyLineupDay[]; }
export interface WeeklyAssignment { id: string; clientId: string; lineupId: string; lineupName: string; notes: string; startDate: string; weeks: number; days: { weekday: number; name: string }[]; createdAt: string; }
export interface Session { id: string; clientId: string; date: string; time: string; duration: number; type: 'In person'|'Online'; location: string; notes: string; }
export interface WorkoutLog { id: string; clientId: string; planId: string; date: string; notes: string; items: {exerciseId: string; sets: number; reps: number; weight: number}[]; }
export interface Measurement { id: string; clientId: string; date: string; weight: number; height: number; waist: number; hip: number; }
export interface Assessment { id: string; clientId: string; date: string; name: string; result: number; unit: string; notes: string; }
export interface ClientInvitation { id: string; name: string; email: string; coachId: string; expiresAt: number; status: 'Pending' | 'Joined' | 'Revoked' | 'Expired'; }
export interface Data { demoMode: boolean; user: User; users: User[]; invitations: ClientInvitation[]; templates: WorkoutTemplate[]; weeklyLineups: WeeklyLineup[]; weeklyAssignments: WeeklyAssignment[]; exercises: Exercise[]; clients: Client[]; plans: Plan[]; sessions: Session[]; logs: WorkoutLog[]; measurements: Measurement[]; assessments: Assessment[]; }
export type Page = 'overview'|'clients'|'library'|'workouts'|'schedule'|'progress'|'equipment'|'accounts';
