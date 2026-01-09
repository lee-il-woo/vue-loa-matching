<template>
  <div class="character-search">
    <!-- API 키 설정 (우측 상단) -->
    <div class="api-key-section">
      <div class="api-key-box">
        <input
          v-model="apiKeyInput"
          type="password"
          placeholder="API 키"
          :disabled="!isApiKeyEditing"
          class="api-key-input"
        />
        <button 
          @click="toggleApiKeyEdit"
          class="api-key-button"
        >
          {{ isApiKeyEditing ? '저장' : '편집' }}
        </button>
      </div>
    </div>

    <div class="search-container">
      
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="원정대당 하나의 캐릭터명을 입력하세요 (여러 명은 쉼표 또는 스페이스로 구분)"
          @keyup.enter="handleSearch"
          :disabled="loading"
          class="search-input"
        />
        <button 
          @click="handleSearch" 
          :disabled="loading || !searchQuery.trim()"
          class="search-button"
        >
          {{ loading ? '검색 중...' : '검색' }}
        </button>
      </div>
      
      <div v-if="loading" class="loading-message">
        검색 중... ({{ searchedCount }}/{{ totalSearchCount }})
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <!-- 여러 원정대 목록 -->
    <div v-if="expeditions.length > 0" class="expeditions-wrapper">
      <div 
        v-for="expedition in expeditions" 
        :key="expedition.id"
        class="expedition-container"
      >
        <div class="expedition-header">
          <div class="header-content" @click="toggleExpedition(expedition.id)">
            <div class="header-left">
              <div class="header-info">
                <h3>{{ expedition.topCharacter.CharacterName }}</h3>
                <div class="subtitle-row">
                  <p class="server-subtitle">
                    {{ expedition.totalCount }}개 캐릭터 · {{ expedition.serverCount }}개 서버
                  </p>
                  <button 
                    v-if="expedition.serverCount > 1"
                    @click.stop="toggleAllServers(expedition.id)"
                    class="toggle-servers-btn"
                  >
                    {{ expedition.showAllServers ? '주 서버만 보기' : '모든 서버 보기' }}
                  </button>
                </div>
              </div>
            </div>
            <div class="header-right">
              <span class="collapse-icon" :class="{ expanded: expedition.isExpanded }">
                ▼
              </span>
            </div>
          </div>
        </div>
        
        <transition name="collapse">
          <div v-show="expedition.isExpanded" class="expedition-content">
            <div 
              v-for="(characters, serverName) in getVisibleServers(expedition)" 
              :key="serverName"
              class="server-section"
            >
              <h4 class="server-title">{{ serverName }}</h4>
              <div class="siblings-grid">
              <CharacterCard 
                v-for="(character, index) in characters" 
                :key="character.CharacterName"
                :character="character"
                :rank="index + 1"
                @update="handleCharacterUpdate"
              />
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- 매칭하기 버튼 (2명 이상일 때) -->
    <button 
      v-if="expeditions.length >= 2"
      class="match-button"
      @click="handleMatch"
    >
      매칭하기
    </button>

    <!-- 매칭 결과 모달 -->
    <MatchResult 
      v-if="showMatchResult"
      :match-results="matchResults"
      @close="showMatchResult = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCharacterSiblings, getStoredApiKey, saveApiKey } from '@/services/lostarkApi'
import type { CharacterInfo } from '@/types/character'
import CharacterCard from './CharacterCard.vue'
import MatchResult from './MatchResult.vue'
import raidData from '@/data/raid.json'

// API 키 관리
const apiKeyInput = ref('')
const isApiKeyEditing = ref(true)

// API 키 편집/저장 토글
function toggleApiKeyEdit() {
  if (isApiKeyEditing.value) {
    // 저장
    saveApiKey(apiKeyInput.value)
    isApiKeyEditing.value = false
  } else {
    // 편집
    isApiKeyEditing.value = true
  }
}

// 초기 로드 시 저장된 API 키 불러오기 (사용자가 저장한 키만)
onMounted(() => {
  const savedKey = getStoredApiKey()
  if (savedKey) {
    apiKeyInput.value = savedKey
  }
})

interface Expedition {
  id: string
  topCharacter: CharacterInfo
  charactersByServer: Record<string, CharacterInfo[]>
  mainServerName: string // 가장 캐릭터가 많은 서버명
  totalCount: number
  serverCount: number
  isExpanded: boolean
  showAllServers: boolean // 모든 서버 표시 여부
}

const searchQuery = ref('')
const loading = ref(false)
const error = ref('')
const expeditions = ref<Expedition[]>([])
const searchedCount = ref(0)
const totalSearchCount = ref(0)
const showMatchResult = ref(false)
interface MatchResultItem {
  categoryName: string
  raidId: number
  raidName: string
  difficulty: string
  maxMembers: number
  maxSupports: number
  supportCount: number
  participants: Array<{
    characterName: string
    className: string
    itemLevel: string
    isSupport: boolean
    expeditionName: string
  }>
}

const matchResults = ref<MatchResultItem[]>([])

// 캐릭터별 선택 상태 저장
interface CharacterSelection {
  characterName: string
  className: string
  itemLevel: string
  expeditionName: string
  selectedRaids: string[] // "categoryName-raidId-difficultyName" 형식
  isSupport: boolean
}

const characterSelections = ref<Map<string, CharacterSelection>>(new Map())

// 아이템 레벨을 숫자로 변환하는 헬퍼 함수
function parseItemLevel(itemLevel: string): number {
  // "1,620.00" 형식을 1620.00으로 변환
  return parseFloat(itemLevel.replace(/,/g, ''))
}

// 캐릭터 업데이트 핸들러
function handleCharacterUpdate(characterName: string, raids: string[], isSupport: boolean) {
  // 캐릭터 정보 찾기
  let characterInfo: CharacterInfo | null = null
  let expeditionName = ''
  
  for (const expedition of expeditions.value) {
    for (const characters of Object.values(expedition.charactersByServer)) {
      const found = characters.find(c => c.CharacterName === characterName)
      if (found) {
        characterInfo = found
        expeditionName = expedition.topCharacter.CharacterName
        break
      }
    }
    if (characterInfo) break
  }
  
  if (characterInfo) {
    characterSelections.value.set(characterName, {
      characterName,
      className: characterInfo.CharacterClassName,
      itemLevel: characterInfo.ItemAvgLevel,
      expeditionName,
      selectedRaids: raids,
      isSupport
    })
  }
}

// 서버별로 그룹화하고 각 서버당 상위 6개씩 추출
function groupCharactersByServer(siblings: CharacterInfo[]): Record<string, CharacterInfo[]> {
  // 서버별로 그룹화
  const grouped: Record<string, CharacterInfo[]> = {}
  
  siblings.forEach(character => {
    const serverName = character.ServerName
    if (!grouped[serverName]) {
      grouped[serverName] = []
    }
    grouped[serverName].push(character)
  })
  
  // 각 서버별로 아이템 레벨 기준 정렬 후 상위 6개만 유지
  Object.keys(grouped).forEach(serverName => {
    const serverChars = grouped[serverName]
    if (serverChars) {
      grouped[serverName] = serverChars
        .sort((a, b) => parseItemLevel(b.ItemAvgLevel) - parseItemLevel(a.ItemAvgLevel))
        .slice(0, 6)
    }
  })
  
  return grouped
}

// 원정대 펼치기/접기 토글
function toggleExpedition(expeditionId: string) {
  const expedition = expeditions.value.find(exp => exp.id === expeditionId)
  if (expedition) {
    expedition.isExpanded = !expedition.isExpanded
  }
}

// 모든 서버 보기 토글
function toggleAllServers(expeditionId: string) {
  const expedition = expeditions.value.find(exp => exp.id === expeditionId)
  if (expedition) {
    expedition.showAllServers = !expedition.showAllServers
  }
}

// 표시할 서버 목록 가져오기
function getVisibleServers(expedition: Expedition): Record<string, CharacterInfo[]> {
  if (expedition.showAllServers || expedition.serverCount === 1) {
    return expedition.charactersByServer
  }
  
  // 주 서버만 반환
  const mainServerChars = expedition.charactersByServer[expedition.mainServerName]
  if (!mainServerChars) return {}
  
  return {
    [expedition.mainServerName]: mainServerChars
  }
}

// 매칭하기 버튼 클릭 핸들러
function handleMatch() {
  // 레이드별로 원정대별 캐릭터 리스트 구성
  const raidExpeditionCharacters = new Map<string, Map<string, CharacterSelection[]>>()
  
  characterSelections.value.forEach(selection => {
    selection.selectedRaids.forEach(raidKey => {
      if (!raidExpeditionCharacters.has(raidKey)) {
        raidExpeditionCharacters.set(raidKey, new Map())
      }
      
      const expeditionMap = raidExpeditionCharacters.get(raidKey)!
      const expeditionName = selection.expeditionName
      
      if (!expeditionMap.has(expeditionName)) {
        expeditionMap.set(expeditionName, [])
      }
      
      expeditionMap.get(expeditionName)!.push(selection)
    })
  })
  
  // 각 레이드별 원정대 캐릭터들을 역할별로 정렬
  raidExpeditionCharacters.forEach((expeditionMap) => {
    expeditionMap.forEach((characters, expeditionName) => {
      // 서폿 우선, 그 다음 아이템 레벨 높은 순
      characters.sort((a, b) => {
        if (a.isSupport !== b.isSupport) {
          return a.isSupport ? -1 : 1
        }
        return parseItemLevel(b.itemLevel) - parseItemLevel(a.itemLevel)
      })
      expeditionMap.set(expeditionName, characters)
    })
  })
  
  // 각 레이드별로 모든 조합 생성
  const results: MatchResultItem[] = []
  
  raidExpeditionCharacters.forEach((expeditionMap, raidKey) => {
    const parts = raidKey.split('-')
    if (parts.length < 3) return
    
    const categoryName = parts[0] || ''
    const raidIdStr = parts[1] || '0'
    const difficultyName = parts[2] || ''
    
    if (!categoryName || !difficultyName) return
    
    const raidId = parseInt(raidIdStr)
    
    // raid.json에서 레이드 정보 찾기
    type RaidInfoType = { 
      id: number
      short_name: string
      name: string
      members: number
      difficulty: Array<{ name: string; min_level: number }> 
    }
    
    let foundRaidInfo: RaidInfoType | undefined
    let foundDifficultyInfo: { name: string; min_level: number } | undefined
    
    Object.entries(raidData as Record<string, RaidInfoType[]>).forEach(([category, raids]) => {
      if (category === categoryName) {
        const found = raids.find(r => r.id === raidId)
        if (found) {
          foundRaidInfo = found
          foundDifficultyInfo = found.difficulty.find(d => d.name === difficultyName)
        }
      }
    })
    
    if (!foundRaidInfo || !foundDifficultyInfo) return
    
    // 타입 가드 후 사용
    const raidInfo = foundRaidInfo
    
    const maxMembers = raidInfo.members
    const maxSupports = Math.floor(maxMembers / 4)
    
    // 원정대 리스트
    const expeditions = Array.from(expeditionMap.entries())
    
    // 모든 가능한 조합을 생성
    const allCombinations: Array<{
      participants: CharacterSelection[]
      supportCount: number
    }> = []
    
    // 중복 체크를 위한 Set
    const existingCombinations = new Set<string>()
    
    // 조합의 고유 키 생성 함수
    function getCombinationKey(participants: CharacterSelection[]): string {
      return participants
        .map(p => p.characterName)
        .sort()
        .join('|')
    }
    
    // 조합 추가 함수 (중복 체크 포함)
    function addCombination(participants: CharacterSelection[], supportCount: number): boolean {
      const key = getCombinationKey(participants)
      if (existingCombinations.has(key)) {
        return false
      }
      existingCombinations.add(key)
      allCombinations.push({ participants, supportCount })
      return true
    }
    
    // 사용된 캐릭터를 추적하기 위한 Set
    const usedCharacters = new Set<string>()
    
    // 사용 가능한 캐릭터 풀을 원정대별로 관리
    const availableByExpedition = new Map<string, CharacterSelection[]>()
    expeditions.forEach(([expName, chars]) => {
      availableByExpedition.set(expName, [...chars])
    })
    
    // 1단계: 서폿이 정확히 1명인 조합을 우선적으로 생성
    let hasMoreSupports = true
    while (hasMoreSupports) {
      hasMoreSupports = false
      
      // 사용 가능한 서폿과 딜러를 원정대별로 찾기
      for (const [supportExpName, supportExpChars] of availableByExpedition.entries()) {
        const availableSupports = supportExpChars.filter(c => 
          c.isSupport && !usedCharacters.has(c.characterName)
        )
        
        if (availableSupports.length === 0) continue
        hasMoreSupports = true
        
        const support = availableSupports[0]!
        const combination: CharacterSelection[] = [support]
        
        // 다른 원정대에서 딜러들을 추가
        for (const [dealerExpName, dealerExpChars] of availableByExpedition.entries()) {
          if (dealerExpName === supportExpName) continue
          if (combination.length >= maxMembers) break
          
          const availableDealers = dealerExpChars.filter(c => 
            !c.isSupport && !usedCharacters.has(c.characterName)
          )
          
          if (availableDealers.length > 0) {
            combination.push(availableDealers[0]!)
          }
        }
        
        // 조합 추가 및 사용된 캐릭터 마킹
        if (addCombination(combination, 1)) {
          combination.forEach(c => usedCharacters.add(c.characterName))
          break // 한 조합을 생성했으면 처음부터 다시 시작
        }
      }
    }
    
    // 2단계: 남은 캐릭터들로 조합 생성
    let hasMoreCharacters = true
    while (hasMoreCharacters) {
      hasMoreCharacters = false
      
      const roundParticipants: CharacterSelection[] = []
      
      // 각 원정대에서 사용하지 않은 캐릭터 중 첫 번째 선택
      for (const [, expChars] of availableByExpedition.entries()) {
        const availableChars = expChars.filter(c => !usedCharacters.has(c.characterName))
        
        if (availableChars.length > 0) {
          hasMoreCharacters = true
          roundParticipants.push(availableChars[0]!)
        }
      }
      
      if (roundParticipants.length === 0) break
      
      // 서폿과 딜러 분리
      const supports = roundParticipants.filter(p => p.isSupport)
      const dealers = roundParticipants.filter(p => !p.isSupport)
      
      // 서폿 제한 적용
      const selectedSupports = supports.slice(0, Math.min(maxSupports, supports.length))
      const remainingSlots = Math.min(maxMembers - selectedSupports.length, dealers.length)
      const selectedDealers = dealers.slice(0, remainingSlots)
      
      const finalParticipants = [...selectedSupports, ...selectedDealers]
      
      // 조합 추가 및 사용된 캐릭터 마킹
      if (finalParticipants.length >= 1) {
        if (addCombination(finalParticipants, selectedSupports.length)) {
          finalParticipants.forEach(c => usedCharacters.add(c.characterName))
        } else {
          // 중복 조합이면 종료 (더 이상 유효한 조합 생성 불가)
          break
        }
      }
    }
    
    // 조합을 우선순위에 따라 정렬
    // 1순위: 서포터가 정확히 1명인 조합
    // 2순위: 참가자 수가 많은 순
    allCombinations.sort((a, b) => {
      const aHasOneSupport = a.supportCount === 1
      const bHasOneSupport = b.supportCount === 1
      
      if (aHasOneSupport !== bHasOneSupport) {
        return aHasOneSupport ? -1 : 1
      }
      
      return b.participants.length - a.participants.length
    })
    
    // 정렬된 조합을 결과에 추가
    allCombinations.forEach((combination, index) => {
      results.push({
        categoryName,
        raidId,
        raidName: `${raidInfo.short_name} #${index + 1}`,
        difficulty: difficultyName,
        maxMembers,
        maxSupports,
        supportCount: combination.supportCount,
        participants: combination.participants.map(p => ({
          characterName: p.characterName,
          className: p.className,
          itemLevel: p.itemLevel,
          isSupport: p.isSupport,
          expeditionName: p.expeditionName
        }))
      })
    })
  })
  
  // 결과 저장 (이미 각 레이드별로 정렬됨)
  matchResults.value = results
  showMatchResult.value = true
}

async function handleSearch() {
  const input = searchQuery.value.trim()
  
  if (!input) {
    error.value = '캐릭터명을 입력해주세요.'
    return
  }

  // 쉼표 또는 스페이스로 분리
  const characterNames = input
    .split(/[,\s]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0)

  if (characterNames.length === 0) {
    error.value = '캐릭터명을 입력해주세요.'
    return
  }

  loading.value = true
  error.value = ''
  expeditions.value = []
  searchedCount.value = 0
  totalSearchCount.value = characterNames.length

  const results: Expedition[] = []
  const errors: string[] = []

  for (const characterName of characterNames) {
    try {
      // 원정대 정보 조회
      const siblingsData = await getCharacterSiblings(characterName)
      
      // 가장 높은 레벨 캐릭터 찾기
      const sortedChars = [...siblingsData]
        .sort((a, b) => parseItemLevel(b.ItemAvgLevel) - parseItemLevel(a.ItemAvgLevel))
      
      if (sortedChars.length === 0) {
        searchedCount.value++
        continue
      }
      
      const topCharacter = sortedChars[0]
      if (!topCharacter) {
        searchedCount.value++
        continue
      }
      
      // 서버별 그룹화
      const charactersByServer = groupCharactersByServer(siblingsData)
      
      // 가장 캐릭터가 많은 서버 찾기
      const serverEntries = Object.entries(charactersByServer)
        .sort(([, charsA], [, charsB]) => (charsB?.length || 0) - (charsA?.length || 0))
      const mainServerName = serverEntries.length > 0 ? serverEntries[0]?.[0] || '' : ''
      
      // 총 캐릭터 수
      const totalCount = Object.values(charactersByServer).reduce((sum, chars) => {
        return sum + (chars?.length || 0)
      }, 0)
      
      results.push({
        id: topCharacter.CharacterName,
        topCharacter,
        charactersByServer,
        mainServerName,
        totalCount,
        serverCount: Object.keys(charactersByServer).length,
        isExpanded: true,
        showAllServers: false
      })
      
      searchedCount.value++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류'
      errors.push(`${characterName}: ${errorMsg}`)
      searchedCount.value++
    }
  }

  expeditions.value = results
  
  if (errors.length > 0) {
    error.value = `일부 캐릭터 검색 실패:\n${errors.join('\n')}`
  }
  
  if (results.length === 0 && errors.length > 0) {
    error.value = '모든 캐릭터 검색에 실패했습니다.'
  }

  loading.value = false
}
</script>

<style scoped>
.character-search {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
}

.search-container {
  margin-bottom: 2rem;
  padding-top: 3rem;
}

h2 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
  text-align: center;
}

/* API 키 섹션 (우측 상단) */
.api-key-section {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 999;
  border-radius: 6px;
  padding: 0.5rem;
}

.api-key-box {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.api-key-input {
  width: 150px;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  transition: border-color 0.3s;
}

.api-key-input:focus {
  outline: none;
  border-color: #42b983;
}

.api-key-input:disabled {
  background-color: #f9f9f9;
  color: #666;
  cursor: not-allowed;
}

.api-key-button {
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  background-color: #42b983;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  white-space: nowrap;
}

.api-key-button:hover {
  background-color: #359268;
}

.search-box {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #42b983;
}

.search-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.search-button {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background-color: #42b983;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.search-button:hover:not(:disabled) {
  background-color: #359268;
}

.search-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  padding: 1rem;
  background-color: #fee;
  border-left: 4px solid #f44;
  border-radius: 4px;
  color: #c33;
  white-space: pre-line;
}

.loading-message {
  padding: 1rem;
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  border-radius: 4px;
  color: #1565c0;
  text-align: center;
  font-weight: 600;
}

/* 원정대 목록 래퍼 */
.expeditions-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 원정대 컨테이너 */
.expedition-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: box-shadow 0.3s;
}

.expedition-container:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 원정대 헤더 */
.expedition-header {
  padding: 1.5rem 2rem;
  cursor: pointer;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-bottom: 2px solid #f0f0f0;
  transition: background-color 0.3s;
}

.expedition-header:hover {
  background: linear-gradient(135deg, #f0f7f4 0%, #f8f9fa 100%);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.server-icon {
  font-size: 2rem;
}

.header-info h3 {
  color: #2c3e50;
  font-size: 1.5rem;
  margin: 0;
  margin-bottom: 0.25rem;
}

.subtitle-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.server-subtitle {
  color: #666;
  font-size: 0.95rem;
  margin: 0;
}

.toggle-servers-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #42b983;
  background-color: transparent;
  border: 1px solid #42b983;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toggle-servers-btn:hover {
  background-color: #42b983;
  color: white;
}

/* 매칭하기 버튼 */
.match-button {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #42b983, #35d07f);
  border: none;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(66, 185, 131, 0.4);
  transition: all 0.3s;
  z-index: 1000;
}

.match-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px rgba(66, 185, 131, 0.6);
  background: linear-gradient(135deg, #35d07f, #42b983);
}

.match-button:active {
  transform: translateY(0);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.top-item-level {
  font-size: 1.5rem;
  font-weight: 700;
  color: #42b983;
}

.collapse-icon {
  font-size: 1.2rem;
  color: #666;
  transition: transform 0.3s;
  display: inline-block;
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

/* 원정대 컨텐츠 */
.expedition-content {
  padding: 1.5rem 2rem 2rem 2rem;
  background: white;
}

/* 서버 섹션 */
.server-section {
  margin-bottom: 2rem;
}

.server-section:last-child {
  margin-bottom: 0;
}

.server-title {
  color: #2c3e50;
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #42b983;
}

/* Collapse 애니메이션 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 1000px;
  opacity: 1;
}

.siblings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .character-search {
    padding: 1rem;
  }

  .search-container {
    padding-top: 2.5rem;
  }

  .api-key-section {
    top: 0;
    right: 0;
    padding: 0.4rem;
  }

  .api-key-input {
    width: 120px;
    font-size: 0.7rem;
    padding: 0.35rem 0.5rem;
  }

  .api-key-button {
    font-size: 0.7rem;
    padding: 0.35rem 0.6rem;
  }

  .expedition-header {
    padding: 1rem;
  }

  .header-left {
    gap: 0.75rem;
  }

  .server-icon {
    font-size: 1.5rem;
  }

  .header-info h3 {
    font-size: 1.2rem;
  }

  .server-subtitle {
    font-size: 0.85rem;
  }

  .header-right {
    gap: 1rem;
  }

  .top-item-level {
    font-size: 1.2rem;
  }

  .expedition-content {
    padding: 1rem;
  }

  .server-title {
    font-size: 1.1rem;
  }

  .siblings-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  .match-button {
    bottom: 1rem;
    right: 1rem;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
  }
}
</style>
