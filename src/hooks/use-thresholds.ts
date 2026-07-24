import { useState, useCallback } from 'react'
import { getThresholds, saveThresholds, type CampaignThresholds } from '../lib/thresholds'

export function useThresholds() {
  const [thresholds, setThresholds] = useState<CampaignThresholds>(getThresholds)

  const save = useCallback((t: CampaignThresholds) => {
    saveThresholds(t)
    setThresholds(t)
  }, [])

  return { thresholds, save }
}
