import { customFetch } from "@workspace/api-client-react";

export interface VocationPath {
  id: string;
  name: string;
  description: string | null;
  currentTitleIndex: number;
  currentLevel: number;
  currentXp: number;
  gateThreshold: number;
  gateActive: boolean;
  milestoneQuestDescription: string | null;
  titleLadder: string[];
  createdAt: string;
  linkedQuestCount: number;
}

export interface VocationLog {
  id: string;
  vocationId: string;
  eventType: string;
  delta: number;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface CreateVocationPayload {
  name: string;
  description?: string;
  gateThreshold?: number;
  milestoneQuestDescription?: string;
  titleLadder?: string[];
}

export interface UpdateVocationPayload {
  name?: string;
  description?: string | null;
  gateThreshold?: number;
  milestoneQuestDescription?: string | null;
  titleLadder?: string[];
}

export async function listVocations(): Promise<VocationPath[]> {
  return customFetch<VocationPath[]>("/api/vocations");
}

export async function getVocation(id: string): Promise<VocationPath> {
  return customFetch<VocationPath>(`/api/vocations/${id}`);
}

export async function createVocation(payload: CreateVocationPayload): Promise<VocationPath> {
  return customFetch<VocationPath>("/api/vocations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVocation(id: string, payload: UpdateVocationPayload): Promise<VocationPath> {
  return customFetch<VocationPath>(`/api/vocations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVocation(id: string): Promise<void> {
  await customFetch<void>(`/api/vocations/${id}`, { method: "DELETE" });
}

export async function completeMilestone(id: string): Promise<VocationPath & { oldTitle: string; newTitle: string; evolved: boolean }> {
  return customFetch<VocationPath & { oldTitle: string; newTitle: string; evolved: boolean }>(
    `/api/vocations/${id}/complete-milestone`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function getVocationLog(id: string): Promise<VocationLog[]> {
  return customFetch<VocationLog[]>(`/api/vocations/${id}/log`);
}

export function getVocXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.4));
}

export function getEvolutionTierColor(titleIndex: number): string {
  const colors = [
    "text-zinc-400 border-zinc-600",
    "text-green-400 border-green-600",
    "text-blue-400 border-blue-600",
    "text-purple-400 border-purple-600",
    "text-amber-400 border-amber-600",
    "text-orange-400 border-orange-500",
    "text-red-400 border-red-500",
  ];
  return colors[Math.min(titleIndex, colors.length - 1)];
}

export function getEvolutionTierBg(titleIndex: number): string {
  const bgs = [
    "bg-zinc-800/40",
    "bg-green-900/30",
    "bg-blue-900/30",
    "bg-purple-900/30",
    "bg-amber-900/30",
    "bg-orange-900/30",
    "bg-red-900/30",
  ];
  return bgs[Math.min(titleIndex, bgs.length - 1)];
}
