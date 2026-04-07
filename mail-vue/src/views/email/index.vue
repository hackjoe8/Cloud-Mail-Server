<template>
  <emailScroll ref="scroll"
               :cancel-success="cancelStar"
               :star-success="addStar"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :star-add="starAdd"
               :star-cancel="starCancel"
               :time-sort="params.timeSort"
               :email-read="emailRead"
               :show-unread="true"
               actionLeft="4px"
               @jump="jumpContent"
  >
    <template #first>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
            v-if="params.timeSort === 0" width="28" height="28"/>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
            width="28" height="28"/>
    </template>

  </emailScroll>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailLatest, emailRead} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {defineOptions, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import { useRoute } from 'vue-router'
import { createAsyncPolling } from '@/utils/async-polling.js';

defineOptions({
  name: 'email'
})

const route = useRoute();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const scroll = ref({})
const params = reactive({
  timeSort: 0,
})
function getPollingDelay() {
  const autoRefresh = Number(settingStore.settings.autoRefresh);
  return autoRefresh > 1 ? autoRefresh * 1000 : 3000;
}

const latestPolling = createAsyncPolling({
  getDelay: getPollingDelay,
  shouldRun() {
    return route.name === 'email';
  },
  async onTick() {
    const autoRefresh = Number(settingStore.settings.autoRefresh);
    if (autoRefresh <= 1 || scroll.value.firstLoad) {
      return;
    }

    const accountId = accountStore.currentAccountId;
    const latestState = scroll.value.latestEmail;
    const latestId = latestState?.emailId;
    const allReceive = latestState?.allReceive;
    const curTimeSort = params.timeSort;

    if (latestId === undefined || accountId !== latestState?.reqAccountId) {
      return;
    }

    const list = await emailLatest(latestId, accountId, allReceive);

    if (accountId !== accountStore.currentAccountId || params.timeSort !== curTimeSort || allReceive !== accountStore.currentAccount.allReceive) {
      return;
    }

    if (list.length === 0) {
      return;
    }

    for (const email of list) {
      email.reqAccountId = accountId;
      email.allReceive = allReceive;

      scroll.value.addItem(email)
    }
  },
  onError(e) {
    if (e.code === 401 || e.code === 403) {
      settingStore.settings.autoRefresh = 0;
    }
    console.error(e)
  }
});

function startLatestPolling() {
  latestPolling.start();
}

function stopLatestPolling() {
  latestPolling.stop();
}

onMounted(() => {
  emailStore.emailScroll = scroll;
  startLatestPolling();
})

onActivated(() => {
  startLatestPolling();
})

onDeactivated(() => {
  stopLatestPolling();
})

onUnmounted(() => {
  stopLatestPolling();
})

watch(() => accountStore.currentAccountId, () => {
  scroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  scroll.value.refreshList();
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showUnread = true
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/message')
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size, requestMeta = {}) {
  const accountId =  accountStore.currentAccountId;
  const allReceive = accountStore.currentAccount.allReceive;
  return emailList(accountId, allReceive, emailId, params.timeSort, size, 0, requestMeta).then(data => {
    if (data.latestEmail) {
      data.latestEmail.reqAccountId = accountId;
      data.latestEmail.allReceive = allReceive;
    }
    return data;
  })
}

</script>
<style>
.icon {
  cursor: pointer;
}
</style>
