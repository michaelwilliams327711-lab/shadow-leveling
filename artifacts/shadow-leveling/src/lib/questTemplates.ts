import { QuestDifficulty, StatBoost } from "@workspace/api-client-react";
import { RANK_BASE_REWARDS } from "@workspace/shared";

const STORAGE_KEY = "shadow-leveling.quest-templates.v1";

// A QuestTemplate is the minimum set of fields needed to one-click rebuild
// the create-quest form. Title + description are user-facing; rank +
// durationMinutes together fully determine the base XP/Gold rewards via the
// shared RANK_BASE_REWARDS table and DURATION_BONUS_PER_MINUTE constant.
export interface QuestTemplate {
  id: string;
  // The label shown in the "Quick Summon" list (e.g. "Deep Work").
  label: string;
  // Quest fields that get populated into the create form on summon.
  title: string;
  description: string;
  category: string;
  difficulty: QuestDifficulty;
  durationMinutes: number;
  statBoost?: StatBoost | null;
  createdAt: number;
  // Number of times this template has been instant-summoned via the Dashboard
  // "Quick Summon" runes. Drives the top-3-most-used ranking. Bumping this is
  // intentionally NOT done by the in-dialog Quick Summon (which only pre-fills
  // the form) — only by a successful one-click spawn.
  usageCount: number;
}

function isQuestDifficulty(value: unknown): value is QuestDifficulty {
  return (
    typeof value === "string" &&
    (Object.values(QuestDifficulty) as string[]).includes(value)
  );
}

function isStatBoost(value: unknown): value is StatBoost {
  return (
    typeof value === "string" &&
    (Object.values(StatBoost) as string[]).includes(value)
  );
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// Defensive parse — any malformed entry is dropped, never thrown, so a
// corrupted localStorage value can never crash the Quests page.
function parseTemplate(raw: unknown): QuestTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const label = typeof r.label === "string" ? r.label.trim() : "";
  const title = typeof r.title === "string" ? r.title : "";
  const description = typeof r.description === "string" ? r.description : "";
  const category = typeof r.category === "string" ? r.category : "";
  const difficulty = isQuestDifficulty(r.difficulty)
    ? r.difficulty
    : QuestDifficulty.E;
  const durationMinutes =
    typeof r.durationMinutes === "number" && r.durationMinutes > 0
      ? Math.floor(r.durationMinutes)
      : 30;
  const statBoost = isStatBoost(r.statBoost) ? r.statBoost : null;
  const createdAt =
    typeof r.createdAt === "number" ? r.createdAt : Date.now();
  // Older v1 entries (saved before usage tracking landed) won't have
  // usageCount — default them to 0 so they still rank, just behind any
  // template that has been summoned at least once.
  const usageCount =
    typeof r.usageCount === "number" && r.usageCount >= 0
      ? Math.floor(r.usageCount)
      : 0;

  if (!id || !label || !title || !category) return null;
  return {
    id,
    label,
    title,
    description,
    category,
    difficulty,
    durationMinutes,
    statBoost,
    createdAt,
    usageCount,
  };
}

export function loadQuestTemplates(): QuestTemplate[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseTemplate)
      .filter((t): t is QuestTemplate => t !== null)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

function persist(templates: QuestTemplate[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // QuotaExceeded / private mode — silently no-op so the UI flow never
    // breaks just because we couldn't persist a template.
  }
}

function newId(): string {
  // crypto.randomUUID is available in every supported browser (and node 20+).
  // Fallback to a timestamp-randomized id if the runtime is missing it.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
    } catch {
      // fall through to fallback
    }
  }
  return `tpl_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export interface CreateQuestTemplateInput {
  label: string;
  title: string;
  description?: string;
  category: string;
  difficulty: QuestDifficulty;
  durationMinutes: number;
  statBoost?: StatBoost | null;
}

export function saveQuestTemplate(
  input: CreateQuestTemplateInput
): QuestTemplate {
  const tpl: QuestTemplate = {
    id: newId(),
    label: input.label.trim(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    category: input.category,
    difficulty: input.difficulty,
    durationMinutes: input.durationMinutes,
    statBoost: input.statBoost ?? null,
    createdAt: Date.now(),
    usageCount: 0,
  };
  const list = loadQuestTemplates();
  list.push(tpl);
  persist(list);
  return tpl;
}

export function deleteQuestTemplate(id: string): void {
  const list = loadQuestTemplates().filter((t) => t.id !== id);
  persist(list);
}

// Bumps the per-template usage counter by one. Called from the Dashboard
// "Quick Summon" runes the moment a template-spawned quest successfully
// commits to the server, so the top-3 ranking reflects real-world reach.
export function incrementTemplateUsage(id: string): QuestTemplate | null {
  const list = loadQuestTemplates();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated: QuestTemplate = {
    ...list[idx],
    usageCount: list[idx].usageCount + 1,
  };
  list[idx] = updated;
  persist(list);
  return updated;
}

// Returns up to `count` templates ordered by usageCount (desc), with
// createdAt (asc) as a stable tiebreaker so the rune order is deterministic
// when several templates share the same usage count.
export function getTopTemplates(count: number): QuestTemplate[] {
  return loadQuestTemplates()
    .slice()
    .sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.createdAt - b.createdAt;
    })
    .slice(0, Math.max(0, count));
}

// Convenience accessor — looks up the rank's base reward bundle, used for
// rendering "+25 XP / +12 G" labels next to each Quick Summon chip without
// re-importing RANK_BASE_REWARDS in every consumer.
export function getTemplateBaseRewards(
  tpl: QuestTemplate
): { xp: number; gold: number } {
  const base = RANK_BASE_REWARDS[tpl.difficulty];
  return base ?? { xp: 0, gold: 0 };
}
