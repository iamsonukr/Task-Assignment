export type Role = 'admin' | 'manager' | 'user';
export type Status = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export interface Prefs { inApp: boolean; email: boolean; muteAssigned: boolean; muteUpdated: boolean }
export interface User { id: string; name: string; email: string; role: Role; notificationPrefs?: Prefs }
export interface UserRef { _id: string; name: string; email: string; role?: Role }
export interface Task {
  _id: string; title: string; description: string; dueDate?: string; priority: Priority; status: Status;
  recurrence: Recurrence; createdBy: UserRef; assignee?: UserRef; completedAt?: string; createdAt: string;
}
export interface Paged<T> { items: T[]; total: number; page: number; limit: number }
export interface Notification { _id: string; type: 'assigned' | 'updated'; message: string; task?: string; read: boolean; createdAt: string }
