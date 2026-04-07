import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

const permContent = read('src/perm/perm.js')
assert.match(permContent, /'setting:query': \[[\s\S]*name: 'domain-list'/, 'setting:query 应该注册 domain-list 路由')
assert.match(permContent, /path: '\/email-list'/, 'domain-list 路由路径应为 /email-list')

const asideContent = read('src/layout/aside/index.vue')
assert.match(asideContent, /router\.push\(\{name: 'domain-list'\}\)/, '左侧边栏应有 domain-list 跳转入口')
assert.match(asideContent, /\$t\('emailSuffixList'\)/, '左侧边栏应显示邮箱列表文案')

const sysSettingContent = read('src/views/sys-setting/index.vue')
assert.doesNotMatch(sysSettingContent, /openDomainManage|DomainManageDialog|emailSuffixManage/, '系统设置页不应继续承载邮箱列表管理入口')

const pagePath = path.join(root, 'src/views/domain-list/index.vue')
assert.ok(fs.existsSync(pagePath), '应存在独立邮箱列表页面')

console.log('domain list page tests passed')
