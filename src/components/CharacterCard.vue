<template>
  <div class="character-card">
    <div class="rank-badge">{{ rank }}</div>
    
    <div class="character-info">
      <p class="character-name">{{ character.CharacterName }}</p>
      <div class="class-row">
        <p class="character-class">{{ character.CharacterClassName }}</p>
        <div v-if="isSupportClass" class="role-toggle">
          <button 
            :class="['role-btn', 'dealer-btn', { active: characterRole === 'dealer' }]"
            @click="characterRole = 'dealer'"
          >
            딜
          </button>
          <button 
            :class="['role-btn', 'support-btn', { active: characterRole === 'support' }]"
            @click="characterRole = 'support'"
          >
            서폿
          </button>
        </div>
      </div>
      <p class="character-item-level">{{ character.ItemAvgLevel }}</p>
    </div>

    <div v-if="topRaids.length > 0" class="raids-section">
      <h5 class="raids-title">추천 레이드</h5>
      <div class="raids-list">
        <label 
          v-for="(raid, index) in topRaids" 
          :key="index"
          class="raid-item"
        >
          <input 
            type="checkbox" 
            v-model="selectedRaids[index]"
            class="raid-checkbox"
          />
          <span class="raid-name">{{ raid.displayName }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { CharacterInfo } from '@/types/character'
import type { AvailableRaid } from '@/types/raid'
import raidData from '@/data/raid.json'

interface Props {
  character: CharacterInfo
  rank: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  update: [characterName: string, raids: string[], isSupport: boolean]
}>()

// 서포터 직업 목록
const SUPPORT_CLASSES = ['바드', '발키리', '홀리나이트', '도화가']

// 서포터 직업인지 확인
const isSupportClass = computed(() => 
  SUPPORT_CLASSES.includes(props.character.CharacterClassName)
)

// 캐릭터 역할 (서포터 직업이면 기본값 'support', 아니면 'dealer')
const characterRole = ref<'support' | 'dealer'>(
  isSupportClass.value ? 'support' : 'dealer'
)

// 아이템 레벨을 숫자로 변환
function parseItemLevel(itemLevel: string): number {
  return parseFloat(itemLevel.replace(/,/g, ''))
}

// 캐릭터가 갈 수 있는 모든 레이드 찾기
const availableRaids = computed((): AvailableRaid[] => {
  const charLevel = parseItemLevel(props.character.ItemAvgLevel)
  const raids: AvailableRaid[] = []

  type RaidData = Record<string, Array<{ 
    id: number
    short_name: string
    name: string
    members: number
    difficulty: Array<{ name: string; min_level: number }>
  }>>

  Object.entries(raidData as RaidData).forEach(([categoryName, categoryRaids]) => {
    categoryRaids.forEach(raid => {
      raid.difficulty.forEach(diff => {
        if (charLevel >= diff.min_level) {
          raids.push({
            categoryName,
            raid,
            difficulty: diff,
            displayName: `${raid.short_name} (${diff.name})`
          })
        }
      })
    })
  })

  // 같은 id를 가진 레이드 중 가장 높은 난이도(min_level)만 선택
  const raidMap = new Map<string, AvailableRaid>()
  
  raids.forEach(raid => {
    const uniqueKey = `${raid.categoryName}-${raid.raid.id}`
    const existing = raidMap.get(uniqueKey)
    
    // 기존 레이드가 없거나, 현재 레이드의 min_level이 더 높으면 교체
    if (!existing || raid.difficulty.min_level > existing.difficulty.min_level) {
      raidMap.set(uniqueKey, raid)
    }
  })

  // Map에서 배열로 변환하고 정렬
  // 1순위: min_level 내림차순 (높은 레벨부터)
  // 2순위: raid.id 내림차순 (높은 ID부터)
  const uniqueRaids = Array.from(raidMap.values())
    .sort((a, b) => {
      if (b.difficulty.min_level !== a.difficulty.min_level) {
        return b.difficulty.min_level - a.difficulty.min_level
      }
      return b.raid.id - a.raid.id
    })

  return uniqueRaids
})

// 최고 레벨 5개 레이드
const topRaids = computed(() => availableRaids.value.slice(0, 5))

// 체크박스 상태 (상위 3개만 체크)
const selectedRaids = ref<boolean[]>(topRaids.value.map((_, index) => index < 3))

// 상태 변경 시 부모에게 알림
function emitUpdate() {
  const selectedRaidNames = topRaids.value
    .filter((_, index) => selectedRaids.value[index])
    .map(raid => `${raid.categoryName}-${raid.raid.id}-${raid.difficulty.name}`)
  
  // 서포터 직업이고 역할이 'support'일 때만 true
  // 서포터 직업이 아니거나, 서포터 직업이지만 'dealer'를 선택했으면 false
  const isSupport = isSupportClass.value && characterRole.value === 'support'
  
  emit('update', props.character.CharacterName, selectedRaidNames, isSupport)
}

// 역할 변경 감지
watch(characterRole, () => {
  emitUpdate()
})

// 체크박스 변경 감지
watch(selectedRaids, () => {
  emitUpdate()
}, { deep: true })

// 초기 상태 전송
onMounted(() => {
  emitUpdate()
})
</script>

<style scoped>
.character-card {
  position: relative;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f9f9f9 0%, #ffffff 100%);
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.character-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  border-color: #42b983;
}

.rank-badge {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #42b983, #35d07f);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  box-shadow: 0 2px 8px rgba(66, 185, 131, 0.4);
  z-index: 1;
}

.character-info {
  text-align: center;
  margin-bottom: 1rem;
}

.character-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 0.5rem;
  margin-top: 0.5rem;
  word-break: break-word;
}

.class-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.character-class {
  color: #666;
  font-size: 1rem;
  margin: 0;
}

.role-toggle {
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
}

.role-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: white;
  color: #666;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  border-right: 1px solid #e0e0e0;
}

.role-btn:last-child {
  border-right: none;
}

.role-btn.support-btn.active {
  background-color: #42b983;
  color: white;
}

.role-btn.dealer-btn.active {
  background-color: #ff7775;
  color: white;
}

.role-btn:hover:not(.active) {
  background-color: #f0f0f0;
}

.character-item-level {
  color: #42b983;
  font-weight: 700;
  font-size: 1.3rem;
  margin-top: 0.5rem;
}

.raids-section {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.raids-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 0.75rem;
  text-align: left;
}

.raids-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.raid-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s;
  text-align: left;
}

.raid-item:hover {
  background-color: rgba(66, 185, 131, 0.1);
}

.raid-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #42b983;
  flex-shrink: 0;
}

.raid-name {
  font-size: 0.9rem;
  color: #2c3e50;
  line-height: 1.3;
}

@media (max-width: 768px) {
  .character-card {
    padding: 1rem;
  }

  .character-name {
    font-size: 1rem;
  }

  .class-row {
    flex-direction: column;
    gap: 0.25rem;
  }

  .role-btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
  }

  .character-item-level {
    font-size: 1.2rem;
  }

  .raid-name {
    font-size: 0.85rem;
  }
}
</style>
