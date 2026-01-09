<template>
  <div class="match-result-overlay" @click.self="$emit('close')">
    <div class="match-result-container">
      <div class="result-header">
        <h2>매칭 결과</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="result-content">
        <div v-if="Object.keys(groupedResults).length === 0" class="no-results">
          <p>매칭 가능한 레이드가 없습니다.</p>
        </div>

        <div v-else class="raid-results">
          <template v-for="(combinations, raidKey) in groupedResults" :key="raidKey">
          <div 
            v-if="combinations.length > 0 && combinations[0]"
            class="raid-group"
          >
            <div class="raid-group-header" @click="toggleRaid(raidKey)">
              <div class="header-left">
                <h3>{{ combinations[0].raidName.replace(/ #\d+$/, '') }} ({{ combinations[0].difficulty }})</h3>
                <span class="combinations-count">{{ combinations.length }}개 조합</span>
              </div>
              <div class="header-right">
                <span class="collapse-icon" :class="{ expanded: expandedRaids[raidKey] }">
                  ▼
                </span>
              </div>
            </div>

            <transition name="collapse">
              <div v-show="expandedRaids[raidKey]" class="combinations-container">
                <div 
                  v-for="(result, index) in combinations" 
                  :key="`${raidKey}-${index}`"
                  class="raid-result-card"
                >
                  <div class="raid-header">
                    <h4>조합 #{{ index + 1 }}</h4>
                  </div>

                  <div class="participants-list">
                    <div 
                      v-for="participant in result.participants" 
                      :key="`${participant.characterName}-${index}`"
                      class="participant-item"
                      :class="{ support: participant.isSupport }"
                    >
                      <span class="participant-name">{{ participant.characterName }}</span>
                      <span class="participant-class">{{ participant.className }}</span>
                      <span class="participant-level">{{ participant.itemLevel }}</span>
                      <span class="participant-role" :class="{ support: participant.isSupport }">
                        {{ participant.isSupport ? '서폿' : '딜' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
interface Participant {
  characterName: string
  className: string
  itemLevel: string
  isSupport: boolean
  expeditionName: string
}

interface MatchResult {
  categoryName: string
  raidId: number
  raidName: string
  difficulty: string
  maxMembers: number
  maxSupports: number
  participants: Participant[]
  supportCount: number
}

interface Props {
  matchResults: MatchResult[]
}

const props = defineProps<Props>()
defineEmits<{
  close: []
}>()

// 레이드별로 그룹화
const groupedResults = computed(() => {
  const groups: Record<string, MatchResult[]> = {}
  
  props.matchResults.forEach(result => {
    const key = `${result.categoryName}-${result.raidId}-${result.difficulty}`
    
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(result)
  })
  
  return groups
})

// 레이드별 펼침 상태
const expandedRaids = ref<Record<string, boolean>>({})

// 초기에 모든 레이드를 펼친 상태로
Object.keys(groupedResults.value).forEach(key => {
  expandedRaids.value[key] = true
})

// 레이드 펼치기/접기 토글
function toggleRaid(raidKey: string) {
  expandedRaids.value[raidKey] = !expandedRaids.value[raidKey]
}
</script>

<style scoped>
.match-result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 2rem;
}

.match-result-container {
  background: white;
  border-radius: 16px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.result-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.8rem;
}

.close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background-color: #f0f0f0;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.5rem;
  color: #666;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background-color: #e0e0e0;
  color: #2c3e50;
}

.result-content {
  padding: 2rem;
  overflow-y: auto;
}

.no-results {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.no-results p {
  font-size: 1.2rem;
}

.raid-results {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.raid-group {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s;
}

.raid-group:hover {
  border-color: #42b983;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.raid-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  cursor: pointer;
  transition: background-color 0.3s;
}

.raid-group-header:hover {
  background: linear-gradient(135deg, #f0f7f4 0%, #f8f9fa 100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-left h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.combinations-count {
  padding: 0.25rem 0.75rem;
  background-color: #42b983;
  color: white;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
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

.combinations-container {
  padding: 1rem;
  background: #fafafa;
}

.raid-result-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  transition: all 0.3s;
}

.raid-result-card:last-child {
  margin-bottom: 0;
}

.raid-result-card:hover {
  border-color: #42b983;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.raid-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.raid-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.raid-info {
  display: flex;
  gap: 1rem;
}

.participant-count,
.support-count {
  font-size: 0.95rem;
  color: #666;
  font-weight: 600;
}

.support-count {
  color: #42b983;
}

.participants-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
}

.participant-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.2s;
}

.participant-item:hover {
  border-color: #42b983;
  transform: translateX(4px);
}

.participant-item.support {
  background-color: #f0f9f4;
}

.participant-name {
  font-weight: 600;
  color: #2c3e50;
}

.participant-class {
  font-size: 0.9rem;
  color: #666;
}

.participant-level {
  font-size: 0.9rem;
  color: #42b983;
  font-weight: 600;
}

.participant-role {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  background-color: #ff7775;
  color: white;
}

.participant-role.support {
  background-color: #42b983;
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
  max-height: 5000px;
  opacity: 1;
}

@media (max-width: 768px) {
  .match-result-overlay {
    padding: 1rem;
  }

  .result-header {
    padding: 1rem;
  }

  .result-header h2 {
    font-size: 1.4rem;
  }

  .result-content {
    padding: 1rem;
  }

  .raid-group-header {
    padding: 1rem;
  }

  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .header-left h3 {
    font-size: 1.2rem;
  }

  .combinations-container {
    padding: 0.75rem;
  }

  .raid-result-card {
    padding: 1rem;
  }

  .participants-list {
    grid-template-columns: 1fr;
  }

  .participant-item {
    grid-template-columns: 1fr auto;
    gap: 0.25rem;
  }

  .participant-class,
  .participant-level {
    grid-column: 1;
  }
}
</style>
