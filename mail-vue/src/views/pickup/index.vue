<template>
  <div v-if="bodyOnlyMode" class="pickup-body-page">
    <div class="loading" :class="pageLoading ? 'loading-show' : 'loading-hide'">
      <loading/>
    </div>
    <el-scrollbar v-if="selectedEmail" class="single-body-scroll">
      <div class="single-body-content">
        <ShadowHtml v-if="selectedEmail.content" :html="formatImage(selectedEmail.content)" />
        <pre v-else class="email-text">{{ selectedEmail.text || '' }}</pre>
      </div>
    </el-scrollbar>
  </div>

  <div v-else class="pickup-page">
    <aside class="mail-list">
      <div class="list-header">
        <div class="mailbox">
          <div class="label">{{ $t('pickupMailbox') }}</div>
          <div class="mailbox-email">{{ mailbox.email || '-' }}</div>
        </div>
        <el-tooltip :content="$t('reload')" placement="bottom">
          <Icon class="icon" icon="ion:reload" width="18" height="18" @click="refresh"/>
        </el-tooltip>
      </div>

      <el-scrollbar class="list-scroll">
        <div class="loading" :class="pageLoading ? 'loading-show' : 'loading-hide'">
          <loading/>
        </div>
        <button
            v-for="mail in emails"
            :key="mail.emailId"
            class="mail-item"
            :class="selectedEmail?.emailId === mail.emailId ? 'active' : ''"
            @click="selectEmail(mail)"
        >
          <span class="mail-subject">{{ mail.subject || $t('noSubject') }}</span>
          <span class="mail-meta">{{ mail.name || mail.sendEmail || '-' }}</span>
          <span class="mail-time">{{ formatTime(mail.createTime) }}</span>
        </button>
        <div class="empty" v-if="!pageLoading && emails.length === 0">
          <el-empty :description="$t('noMessagesFound')" :image-size="120"/>
        </div>
        <div class="load-more" v-if="emails.length > 0">
          <el-button text :loading="loadingMore" @click="loadMore">{{ $t('loadMore') }}</el-button>
        </div>
      </el-scrollbar>
    </aside>

    <main class="mail-content">
      <template v-if="selectedEmail">
        <div class="content-header">
          <h1>{{ selectedEmail.subject || $t('noSubject') }}</h1>
          <div class="content-meta">
            <div><span>{{ $t('from') }}</span>{{ selectedEmail.name || '' }} &lt;{{ selectedEmail.sendEmail || '-' }}&gt;</div>
            <div><span>{{ $t('recipient') }}</span>{{ formatRecipients(selectedEmail.recipient) }}</div>
            <div><span>{{ $t('date') }}</span>{{ formatDetailDate(selectedEmail.createTime) }}</div>
          </div>
        </div>

        <el-scrollbar class="body-scroll">
          <ShadowHtml v-if="selectedEmail.content" :html="formatImage(selectedEmail.content)" />
          <pre v-else class="email-text">{{ selectedEmail.text }}</pre>

          <div class="att" v-if="selectedEmail.attList?.length">
            <div class="att-title">
              <span>{{ $t('attachments') }}</span>
              <span>{{ $t('attCount', {total: selectedEmail.attList.length}) }}</span>
            </div>
            <div class="att-box">
              <div class="att-item" v-for="att in selectedEmail.attList" :key="att.attId">
                <Icon class="att-file-icon" v-bind="getIconByName(att.filename)" @click="previewImage(att.key)" />
                <button class="att-name" @click="previewImage(att.key)">{{ att.filename }}</button>
                <span class="att-size">{{ formatBytes(att.size) }}</span>
                <el-tooltip v-if="isImage(att.filename)" :content="$t('preview')" placement="top">
                  <Icon class="icon" icon="hugeicons:view" width="21" height="21" @click="previewImage(att.key)"/>
                </el-tooltip>
                <a :href="cvtR2Url(att.key)" download>
                  <el-tooltip :content="$t('download')" placement="top">
                    <Icon class="icon" icon="system-uicons:push-down" width="22" height="22"/>
                  </el-tooltip>
                </a>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </template>
      <el-empty v-else-if="!pageLoading" :description="$t('noMessagesFound')" />
    </main>

  </div>

  <el-image-viewer
      v-if="showPreview"
      :url-list="srcList"
      show-progress
      @close="showPreview = false"
  />
</template>

<script setup>
import {computed, onMounted, reactive, ref} from 'vue';
import {useRoute} from 'vue-router';
import {Icon} from '@iconify/vue';
import ShadowHtml from '@/components/shadow-html/index.vue';
import loading from '@/components/loading/index.vue';
import {pickupPublicList, pickupPublicMessage} from '@/request/pickup.js';
import {formatBytes, getExtName} from '@/utils/file-utils.js';
import {formatDetailDate, tzDayjs} from '@/utils/day.js';
import {cvtR2Url, toOssDomain} from '@/utils/convert.js';
import {getIconByName} from '@/utils/icon-utils.js';
import {useSettingStore} from '@/store/setting.js';

const route = useRoute();
const settingStore = useSettingStore();
const token = String(route.params.token || '');
const messageIndex = computed(() => Number(route.params.messageIndex) || 0);
const bodyOnlyMode = computed(() => messageIndex.value > 0);
const mailbox = reactive({email: ''});
const emails = ref([]);
const selectedEmail = ref(null);
const pageLoading = ref(false);
const loadingMore = ref(false);
const showPreview = ref(false);
const srcList = reactive([]);

onMounted(() => {
  if (bodyOnlyMode.value) {
    loadMessageBody();
  } else {
    refresh();
  }
});

function setData(data, append = false) {
  mailbox.email = data.mailbox?.email || '';
  const list = data.list || [];
  emails.value = append ? [...emails.value, ...list] : list;
  if (!append) {
    selectedEmail.value = emails.value[0] || null;
  }
}

function refresh() {
  pageLoading.value = true;
  pickupPublicList(token, null, 20)
      .then(data => setData(data))
      .finally(() => {
        pageLoading.value = false;
      });
}

function loadMessageBody() {
  pageLoading.value = true;
  pickupPublicMessage(token, messageIndex.value)
      .then(data => {
        mailbox.email = data.mailbox?.email || '';
        selectedEmail.value = data.message || null;
      })
      .catch(() => {
        selectedEmail.value = null;
      })
      .finally(() => {
        pageLoading.value = false;
      });
}

function loadMore() {
  const lastEmail = emails.value[emails.value.length - 1];
  if (!lastEmail) return;

  loadingMore.value = true;
  pickupPublicList(token, lastEmail.emailId, 20)
      .then(data => setData(data, true))
      .finally(() => {
        loadingMore.value = false;
      });
}

function selectEmail(mail) {
  selectedEmail.value = mail;
}

function formatRecipients(recipient) {
  try {
    const list = JSON.parse(recipient || '[]');
    return list.map(item => item.address).join(', ');
  } catch {
    return recipient || '';
  }
}

function formatTime(time) {
  if (!time) return '';
  const date = tzDayjs(time);
  return date.format('YYYY-MM-DD HH:mm');
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function isImage(filename) {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'jfif', 'webp'].includes(getExtName(filename));
}

function previewImage(key) {
  if (!isImage(key)) return;
  srcList.length = 0;
  srcList.push(cvtR2Url(key));
  showPreview.value = true;
}
</script>

<style scoped lang="scss">
.pickup-page {
  height: 100vh;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  overflow: hidden;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(210px, 34vh) 1fr;
  }
}

.pickup-body-page {
  height: 100vh;
  min-height: 0;
  background: #fff;
  color: #13181D;
  position: relative;
}

.single-body-scroll {
  height: 100vh;
}

.single-body-content {
  min-height: 100vh;
  padding: 0;
}

.mail-list {
  border-right: 1px solid var(--el-border-color);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  @media (max-width: 820px) {
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color);
  }
}

.list-header {
  min-height: 58px;
  padding: 10px 14px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  box-shadow: var(--header-actions-border);

  .label {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .mailbox-email {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.list-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
}

.mail-item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: transparent;
  color: inherit;
  text-align: left;
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  cursor: pointer;

  &.active {
    background: var(--el-color-primary-light-9);
  }

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.mail-subject,
.mail-meta,
.mail-time {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mail-subject {
  font-weight: 700;
}

.mail-meta,
.mail-time {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mail-content {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.content-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--el-border-color);

  h1 {
    margin: 0 0 10px;
    font-size: 21px;
    line-height: 1.3;
    word-break: break-word;
  }
}

.content-meta {
  display: grid;
  gap: 6px;
  color: var(--el-text-color-regular);
  font-size: 13px;

  div {
    word-break: break-word;
  }

  span {
    display: inline-block;
    min-width: 56px;
    color: var(--el-text-color-secondary);
    font-weight: 700;
  }
}

.body-scroll {
  flex: 1;
  min-height: 0;
  padding: 18px 20px 30px;
}

.email-text {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.att {
  margin-top: 28px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  width: fit-content;
  max-width: 100%;
}

.att-title {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 10px;
  font-weight: 700;
}

.att-box {
  min-width: min(430px, calc(100vw - 56px));
  max-width: 680px;
  display: grid;
  gap: 10px;
}

.att-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light);

  a {
    display: flex;
    color: var(--el-text-color-secondary);
  }
}

.att-file-icon {
  cursor: pointer;
}

.att-name {
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.att-size {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.icon {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.empty,
.load-more {
  padding: 18px;
  display: flex;
  justify-content: center;
}

.loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--loadding-background);
}

.loading-show {
  opacity: 1;
  transition: all 200ms ease 200ms;
}

.loading-hide {
  opacity: 0;
  pointer-events: none;
  transition: var(--loading-hide-transition);
}
</style>
