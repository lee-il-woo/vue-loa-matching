import type { CharacterInfo, CharacterProfile } from '@/types/character'

const API_BASE_URL = 'https://developer-lostark.game.onstove.com'
const DEFAULT_API_KEY = import.meta.env.VITE_APP_LOA_API_KEY

// 로컬스토리지 키
const STORAGE_KEY = ''

// API 키 가져오기 (로컬스토리지 우선, 없으면 환경변수)
export function getApiKey(): string {
  const storedKey = localStorage.getItem(STORAGE_KEY)
  return storedKey || DEFAULT_API_KEY || ''
}

// 로컬스토리지에 저장된 API 키만 가져오기 (기본 키 제외)
export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || ''
}

// API 키 저장
export function saveApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key)
}

// API 키 삭제
export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// API 요청 헤더 설정
const getHeaders = () => ({
  Authorization: `bearer ${getApiKey()}`,
  'Content-Type': 'application/json',
})

/**
 * 캐릭터 기본 정보 조회
 * @param characterName 캐릭터명
 * @returns 캐릭터 정보 배열 (본인 + 같은 원정대 캐릭터들)
 */
export async function getCharacterSiblings(characterName: string): Promise<CharacterInfo[]> {
  const response = await fetch(
    `${API_BASE_URL}/characters/${encodeURIComponent(characterName)}/siblings`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
  )

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
    }
    if (response.status === 404) {
      throw new Error('캐릭터를 찾을 수 없습니다.')
    }
    throw new Error(`API 요청 실패: ${response.status}`)
  }

  return await response.json()
}

/**
 * 캐릭터 상세 정보 조회 (프로필)
 * @param characterName 캐릭터명
 * @returns 캐릭터 상세 프로필 정보
 */
export async function getCharacterProfile(characterName: string): Promise<CharacterProfile> {
  const response = await fetch(
    `${API_BASE_URL}/armories/characters/${encodeURIComponent(characterName)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
  )

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
    }
    if (response.status === 404) {
      throw new Error('캐릭터를 찾을 수 없습니다.')
    }
    throw new Error(`API 요청 실패: ${response.status}`)
  }

  return await response.json()
}
