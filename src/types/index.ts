
export type ConnectionStatus = 'online' | 'offline';

export interface SyncInfo {
  lastSync: string | null;
  status: ConnectionStatus;
  pendingChanges: number;
}

export interface Class {
  id: string;
  name: string;
  grade?: string;
  servants: string[];
  createdAt: string;
  updatedAt: string;
}

export type FieldType = 'text' | 'number' | 'select' | 'phone';

export interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // For select fields
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location?: string;
  description?: string;
  customFields: CustomField[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendeeValue {
  fieldId: string;
  value: string | number;
}

export interface Attendee {
  id: string;
  eventId: string;
  classId: string;
  values: AttendeeValue[];
  attended: boolean;
  createdAt: string;
  updatedAt: string;
}
