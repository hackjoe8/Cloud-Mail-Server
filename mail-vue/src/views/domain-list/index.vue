<template>
  <div class="domain-page">
    <div class="page-header">
      <div>
        <div class="page-title">{{ t('emailSuffixList') }}</div>
        <div class="page-desc">{{ t('emailSuffixPageDesc') }}</div>
      </div>
      <div class="header-actions">
        <el-button :loading="pageLoading" @click="reloadDomains">{{ t('reload') }}</el-button>
        <el-button type="primary" :loading="settingLoading" @click="submit">{{ t('save') }}</el-button>
      </div>
    </div>

    <div class="page-grid">
      <div class="panel batch-panel">
        <div class="panel-title">{{ t('batchImportDomains') }}</div>
        <el-input
          v-model="batchInput"
          type="textarea"
          :rows="6"
          :placeholder="t('domainBatchInputPlaceholder')"
        />
        <div class="panel-actions">
          <el-button @click="appendBlankRow">{{ t('add') }}</el-button>
          <el-button type="primary" plain @click="importBatchDomains">{{ t('batchImport') }}</el-button>
          <el-button type="danger" plain :disabled="selectedIds.length === 0" @click="removeSelectedDomains">
            {{ t('deleteSelected') }}
          </el-button>
        </div>
      </div>

      <div class="panel list-panel">
        <div class="list-header">
          <div class="panel-title">{{ t('emailSuffixList') }}</div>
          <el-tag>{{ managedDomains.length }}</el-tag>
        </div>
        <el-table v-loading="pageLoading" :data="managedDomains" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="48"/>
          <el-table-column :label="t('domain')" min-width="300">
            <template #default="{ row }">
              <el-input
                v-if="row.editing"
                v-model="row.value"
                :placeholder="t('domainDesc')"
                @keyup.enter="saveRow(row)"
              />
              <span v-else>@{{ row.value }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('action')" width="220" fixed="right">
            <template #default="{ row, $index }">
              <div class="row-actions">
                <template v-if="row.editing">
                  <el-button link type="primary" @click="saveRow(row)">{{ t('save') }}</el-button>
                  <el-button link @click="cancelEdit(row, $index)">{{ t('cancel') }}</el-button>
                </template>
                <template v-else>
                  <el-button link type="primary" @click="startEdit(row)">{{ t('change') }}</el-button>
                  <el-button link type="danger" @click="removeRow($index)">{{ t('delete') }}</el-button>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineOptions, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { settingQuery, settingSet } from '@/request/setting.js'
import { useSettingStore } from '@/store/setting.js'
import { isValidDomain, normalizeDomainValue, parseDomainBatchInput } from '@/utils/domain.js'

defineOptions({
  name: 'domain-list'
})

const { t } = useI18n()
const settingStore = useSettingStore()

const pageLoading = ref(true)
const settingLoading = ref(false)
const batchInput = ref('')
const managedDomains = ref([])
const selectedIds = ref([])
let domainRowId = 0

function createRow(value = '', editing = false) {
  domainRowId += 1
  const normalized = normalizeDomainValue(value)
  return {
    id: domainRowId,
    value: normalized,
    originalValue: normalized,
    editing,
    isNew: editing && !normalized
  }
}

function resetManagedDomains(domains = []) {
  batchInput.value = ''
  selectedIds.value = []
  managedDomains.value = (domains || []).map(item => createRow(item.replace(/^@+/, ''), false))
}

async function loadDomains() {
  pageLoading.value = true
  try {
    const setting = await settingQuery()
    settingStore.settings = setting
    settingStore.domainList = setting.domainList || []
    resetManagedDomains(settingStore.domainList)
  } finally {
    pageLoading.value = false
  }
}

function reloadDomains() {
  loadDomains()
}

function appendBlankRow() {
  managedDomains.value.unshift(createRow('', true))
}

function handleSelectionChange(selection) {
  selectedIds.value = selection.map(item => item.id)
}

function collectDomainList() {
  const normalizedList = []
  const seen = new Set()

  for (const row of managedDomains.value) {
    const normalized = normalizeDomainValue(row.value)

    if (!normalized) {
      ElMessage({ message: t('domainListEmptyMsg'), type: 'error', plain: true })
      return null
    }

    if (!isValidDomain(normalized, { allowWildcard: true })) {
      ElMessage({ message: t('invalidDomainMsg'), type: 'error', plain: true })
      return null
    }

    if (seen.has(normalized)) {
      ElMessage({ message: t('duplicateDomainMsg'), type: 'error', plain: true })
      return null
    }

    seen.add(normalized)
    row.value = normalized
    row.originalValue = normalized
    row.editing = false
    row.isNew = false
    normalizedList.push(normalized)
  }

  return normalizedList
}

function importBatchDomains() {
  const batchDomains = parseDomainBatchInput(batchInput.value)
  if (batchDomains.length === 0) {
    ElMessage({ message: t('domainListEmptyMsg'), type: 'warning', plain: true })
    return
  }

  const next = new Set(managedDomains.value.map(item => normalizeDomainValue(item.value)))
  let addedCount = 0

  batchDomains.forEach(item => {
    if (isValidDomain(item, { allowWildcard: true }) && !next.has(item)) {
      managedDomains.value.push(createRow(item, false))
      next.add(item)
      addedCount += 1
    }
  })

  if (addedCount === 0) {
    ElMessage({ message: t('invalidDomainMsg'), type: 'warning', plain: true })
    return
  }

  batchInput.value = ''
}

function removeSelectedDomains() {
  if (selectedIds.value.length === 0) return
  managedDomains.value = managedDomains.value.filter(item => !selectedIds.value.includes(item.id))
  selectedIds.value = []
}

function startEdit(row) {
  row.originalValue = row.value
  row.editing = true
}

function saveRow(row) {
  const normalized = normalizeDomainValue(row.value)
  if (!isValidDomain(normalized, { allowWildcard: true })) {
    ElMessage({ message: t('invalidDomainMsg'), type: 'error', plain: true })
    return
  }

  const exists = managedDomains.value.some(item => item.id !== row.id && normalizeDomainValue(item.value) === normalized)
  if (exists) {
    ElMessage({ message: t('duplicateDomainMsg'), type: 'error', plain: true })
    return
  }

  row.value = normalized
  row.originalValue = normalized
  row.editing = false
  row.isNew = false
}

function cancelEdit(row, index) {
  if (row.isNew && !row.originalValue) {
    managedDomains.value.splice(index, 1)
    return
  }

  row.value = row.originalValue
  row.editing = false
}

function removeRow(index) {
  managedDomains.value.splice(index, 1)
}

async function submit() {
  const domainList = collectDomainList()
  if (!domainList || domainList.length === 0) {
    if (domainList?.length === 0) {
      ElMessage({ message: t('domainListEmptyMsg'), type: 'error', plain: true })
    }
    return
  }

  settingLoading.value = true
  try {
    await settingSet({ domainList })
    await loadDomains()
    ElMessage({ message: t('saveSuccessMsg'), type: 'success', plain: true })
  } finally {
    settingLoading.value = false
  }
}

loadDomains()
</script>

<style scoped lang="scss">
.domain-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header,
.list-header,
.panel-actions,
.row-actions {
  display: flex;
  align-items: center;
}

.page-header,
.list-header {
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
}

.page-desc {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}

.header-actions,
.panel-actions,
.row-actions {
  gap: 10px;
}

.page-grid {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
}

.panel {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--el-box-shadow-light);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.panel-actions {
  margin-top: 12px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .domain-page {
    padding: 12px;
  }

  .page-grid {
    grid-template-columns: 1fr;
  }

  .page-header,
  .list-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
