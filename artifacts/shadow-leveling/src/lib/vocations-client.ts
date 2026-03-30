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

const BASE = "/api";

export async function listVocations(): Promise<VocationPath[]> {
  const res = await fetch(`${BASE}/vocations`);
  if (!res.ok) throw new Error("Failed to list vocations");
  return res.json();
}

export async function getVocation(id: string): Promise<VocationPath> {
  const res = await fetch(`${BASE}/vocations/${id}`);
  if (!res.ok) throw new Error("Failed to get vocation");
  return res.json();
}

export async function createVocation(payload: CreateVocationPayload): Promise<VocationPath> {
  const res = await fetch(`${BASE}/vocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create vocation");
  }
  return res.json();
}

export async function updateVocation(id: string, payload: UpdateVocationPayload): Promise<VocationPath> {
  const res = await fetch(`${BASE}/vocations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to update vocation");
  }
  return res.json();
}

export async function deleteVocation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/vocations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete vocation");
}

export async function completeMilestone(id: string): Promise<VocationPath & { oldTitle: string; newTitle: string; evolved: boolean }> {
  const res = await fetch(`${BASE}/vocations/${id}/complete-milestone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to complete milestone");
  }
  return res.json();
}

export async function getVocationLog(id: string): Promise<VocationLog[]> {
  const res = await fetch(`${BASE}/vocations/${id}/log`);
  if (!res.ok) throw new Error("Failed to get vocation log");
  return res.json();
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
