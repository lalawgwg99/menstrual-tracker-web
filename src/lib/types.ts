export type FlowLevel = 'spotting' | 'light' | 'medium' | 'heavy'
export type MoodTag = 'happy' | 'calm' | 'sad' | 'irritable' | 'anxious' | 'tired'
export type SymptomTag = 'cramps' | 'headache' | 'bloating' | 'backpain' | 'acne' | 'breast_tenderness' | 'nausea'

export interface DailyLog {
  date: string
  flow?: FlowLevel
  symptoms?: SymptomTag[]
  mood?: MoodTag
  temperature?: number
  note?: string
  cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'eggwhite'
  ovulationTest?: 'negative' | 'positive'
  sex?: boolean
  weight?: number
  medication?: string
}

export interface PeriodEntry {
  id: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  logs?: DailyLog[]
}
