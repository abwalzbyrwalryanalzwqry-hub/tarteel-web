import { countLocalEntities } from "./localRepository";

export type LocalDashboardSnapshot = {
  centers: number;
  circles: number;
  teachers: number;
  students: number;
  sessions: number;
  attendanceRecords: number;
  memorizationRecords: number;
  revisionRecords: number;
  generatedAt: string;
};

export async function getLocalDashboardSnapshot(): Promise<LocalDashboardSnapshot> {
  const [centers, circles, teachers, students, sessions, attendanceRecords, memorizationRecords, revisionRecords] = await Promise.all([
    countLocalEntities("center"),
    countLocalEntities("circle"),
    countLocalEntities("teacher"),
    countLocalEntities("student"),
    countLocalEntities("session"),
    countLocalEntities("attendance"),
    countLocalEntities("memorization"),
    countLocalEntities("revision"),
  ]);
  return {
    centers,
    circles,
    teachers,
    students,
    sessions,
    attendanceRecords,
    memorizationRecords,
    revisionRecords,
    generatedAt: new Date().toISOString(),
  };
}
