export interface ApiSportsFixtureStatus {
  short: string
  long?: string
}

export interface ApiSportsFixtureTeam {
  id: number
  name: string
  winner: boolean | null
}

export interface ApiSportsFixtureGoals {
  home: number | null
  away: number | null
}

export interface ApiSportsFixtureScore {
  halftime: ApiSportsFixtureGoals
  fulltime: ApiSportsFixtureGoals
  extratime: ApiSportsFixtureGoals
  penalty: ApiSportsFixtureGoals
}

export interface ApiSportsFixtureItem {
  fixture: {
    id: number
    date: string
    timestamp?: number
    status: ApiSportsFixtureStatus
  }
  teams: {
    home: ApiSportsFixtureTeam
    away: ApiSportsFixtureTeam
  }
  goals: ApiSportsFixtureGoals
  score: ApiSportsFixtureScore
}

export interface ApiSportsTeamItem {
  team: {
    id: number
    name: string
    code: string | null
  }
}

export interface ApiSportsPaging {
  current: number
  total: number
}

export interface ApiSportsListResponse<T> {
  response: T[]
  paging?: ApiSportsPaging
  errors?: Record<string, string> | string[]
}
