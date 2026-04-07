<template>
  <el-dialog
      :model-value="modelValue"
      :title="t('emailSuffixManage')"
      width="760"
      class="domain-manage-dialog"
      @close="emit('update:modelValue', false)"
  >
    <div class="domain-manage-body">
      <div class="batch-panel">
        <div class="panel-title">{{ t('batchImportDomains') }}</div>
        <el-input
            v-model="batchInput"
            type="textarea"
            :rows="5"
            :placeholder="t('domainBatchInputPlaceholder')"
        />
        <div class="batch-actions">
          <el-button @click="appendBlankRow">{{ t('add') }}</el-button>
          <el-button type="primary" plain @click="importBatchDomains">{{ t('batchImport') }}</el-button>
          <el-button :disabled="selectedIds.length === 0" type="danger" plain @click="removeSelectedDomains">
            {{ t('deleteSelected') }}
          </el-button>
        </div>
      </div>

      <div class="table-panel">
        <div class="panel-title">
          <span>{{ t('emailSuffixList') }}</span>
          <el-tag>{{ managedDomains.length }}</el-tag>
        </div>
        <el-table :data="managedDomains" @selection-change="handleSelectionChange">
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

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">{{ t('cancel') }}</el-button>
        <el-button type="primary" :loading="loading" @click="submit">{{ t('save') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isValidDomain, normalizeDomainValue, parseDomainBatchInput } from '@/utils/domain.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  domains: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const { t } = useI18n()
const batchInput = ref('')
const managedDomains = ref([])
const selectedIds = ref([])
let domainRowId = 0

watch(
    () => [props.modelValue, props.domains],
    ([visible]) => {
      if (!visible) return
      resetManagedDomains()
    },
    { immediate: true, deep: true }
)

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

function resetManagedDomains() {
  batchInput.value = ''
  selectedIds.value = []
  managedDomains.value = (props.domains || []).map(item => createRow(item.replace(/^@+/, ''), false))
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
      ElMessage({
        message: t('domainListEmptyMsg'),
        type: 'error',
        plain: true
      })
      return null
    }

    if (!isValidDomain(normalized, { allowWildcard: true })) {
      ElMessage({
        message: t('invalidDomainMsg'),
        type: 'error',
        plain: true
      })
      return null
    }

    if (seen.has(normalized)) {
      ElMessage({
        message: t('duplicateDomainMsg'),
        type: 'error',
        plain: true
      })
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
    ElMessage({
      message: t('domainListEmptyMsg'),
      type: 'warning',
      plain: true
    })
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
    ElMessage({
      message: t('invalidDomainMsg'),
      type: 'warning',
      plain: true
    })
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
    ElMessage({
      message: t('invalidDomainMsg'),
      type: 'error',
      plain: true
    })
    return
  }

  const exists = managedDomains.value.some(item => item.id !== row.id && normalizeDomainValue(item.value) === normalized)
  if (exists) {
    ElMessage({
      message: t('duplicateDomainMsg'),
      type: 'error',
      plain: true
    })
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

function submit() {
  const domainList = collectDomainList()
  if (!domainList || domainList.length === 0) {
    if (domainList?.length === 0) {
      ElMessage({
        message: t('domainListEmptyMsg'),
        type: 'error',
        plain: true
      })
    }
    return
  }

  emit('save', domainList)
}
</script>

<style scoped lang="scss">
.domain-manage-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 10px;
}

.batch-actions,
.dialog-footer,
.row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.batch-actions {
  margin-top: 12px;
  justify-content: flex-end;
}

.dialog-footer {
  justify-content: flex-end;
}
</style>
