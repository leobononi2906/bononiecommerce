export interface CampaignThresholds {
  roas_green: number
  roas_yellow: number
  cpl_green: number
  cpl_yellow: number
  conv_green: number
  conv_yellow: number
  invest_fat_min: number
  invest_fat_ideal_min: number
  invest_fat_ideal_max: number
  invest_fat_max: number
  min_spend_for_verdict: number
  tmr_green: number
  tmr_yellow: number
}

const DEFAULTS: CampaignThresholds = {
  roas_green: 4,
  roas_yellow: 2,
  cpl_green: 15,
  cpl_yellow: 25,
  conv_green: 12,
  conv_yellow: 5,
  invest_fat_min: 4,
  invest_fat_ideal_min: 5,
  invest_fat_ideal_max: 6,
  invest_fat_max: 7,
  min_spend_for_verdict: 50,
  tmr_green: 5,
  tmr_yellow: 15,
}

const STORAGE_KEY = 'stonni_campaign_thresholds'

export function getThresholds(): CampaignThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveThresholds(t: CampaignThresholds): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
}

export function getDefaults(): CampaignThresholds {
  return { ...DEFAULTS }
}
