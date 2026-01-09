// 레이드 타입 정의
export interface RaidDifficulty {
  name: string
  min_level: number
}

export interface Raid {
  id: number
  short_name: string
  name: string
  members: number
  difficulty: RaidDifficulty[]
}

export interface RaidCategory {
  [key: string]: Raid[]
}

export interface AvailableRaid {
  categoryName: string
  raid: Raid
  difficulty: RaidDifficulty
  displayName: string
}
