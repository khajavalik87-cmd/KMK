
export enum EventCategory {
  ACADEMIC = 'Academic',
  SOCIAL = 'Social',
  SPORTS = 'Sports',
  CULTURAL = 'Cultural',
  WORKSHOP = 'Workshop',
  CAREER = 'Career'
}

export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatar?: string;
  usn?: string;
  department?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: EventCategory;
  description: string;
  organizer: string;
  imageUrl: string;
  attendees: number;
  capacity: number;
}
