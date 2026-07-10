export const MAX_PLAYER_LEVEL = 100;
export const PLAYER_PROGRESSION_VERSION = 5;
export const PAPAL_BADGE_EXPERIENCE_INTERVAL = 500_000;

const FIRST_LEVEL_UP_EXPERIENCE = 100;
const FINAL_LEVEL_UP_EXPERIENCE = 200_000;
const LEVEL_TRANSITIONS = MAX_PLAYER_LEVEL - 1;

export function experienceRequiredForLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL - 1, Math.floor(level)));
  const progress = (safeLevel - 1) / (LEVEL_TRANSITIONS - 1);
  return Math.round(FIRST_LEVEL_UP_EXPERIENCE + (FINAL_LEVEL_UP_EXPERIENCE - FIRST_LEVEL_UP_EXPERIENCE) * progress ** 2);
}

export const MAX_LEVEL_TOTAL_EXPERIENCE = Array.from({ length: MAX_PLAYER_LEVEL - 1 }, (_, index) => experienceRequiredForLevel(index + 1)).reduce((total, required) => total + required, 0);

export function papalBadgesEarnedFromExperience(totalExperience: number) {
  return Math.floor(Math.max(0, Math.floor(totalExperience) - MAX_LEVEL_TOTAL_EXPERIENCE) / PAPAL_BADGE_EXPERIENCE_INTERVAL);
}

export function getPlayerProgress(totalExperience: number) {
  let level = 1;
  let current = Math.max(0, Math.floor(totalExperience));

  while (level < MAX_PLAYER_LEVEL) {
    const required = experienceRequiredForLevel(level);
    if (current < required) return { level, current, required };
    current -= required;
    level += 1;
  }

  return { level: MAX_PLAYER_LEVEL, current: 0, required: 0 };
}
