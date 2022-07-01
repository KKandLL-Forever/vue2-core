import config from '../config'
import {initUse} from './use'
import {initMixin} from './mixin'
import {initExtend} from './extend'
import {initAssetRegisters} from './assets'
import {set, del} from '../observer/index'
import {ASSET_TYPES} from 'shared/constants'
import builtInComponents from '../components/index'
import {observe} from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'
import type {GlobalAPI} from 'types/global-api'

export function initGlobalAPI(Vue: GlobalAPI) {
  console.log('Start---->执行initGlobalAPI 挂载静态方法')
  // config 全局配置，详情看文档API
  const configDef: Record<string, any> = {}
  configDef.get = () => config
  if (__DEV__) {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)
  console.dir(`挂载config全局配置`)

  // exposed util methods.
  // 这些工具方法不视作全局API的一部分，除非你能意识到这其中的风险，否则不要去使用(依赖)他们
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 静态方法
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 新增显式 observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }
  // 初始化Vue.options对象
  //Object.create(null),不给对象设置原型，提高性能
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })
  console.dir(`初始化Vue.options对象`)

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-
  //存储Vue的构造函数
  Vue.options._base = Vue

  // 扩展keep-alive组件
  //extend 就是把第二个参数(对象)，拷贝到第一个参数上
  extend(Vue.options.components, builtInComponents)

  // 注册Vue.use()
  initUse(Vue)
  // 注册Vue.mixin()
  initMixin(Vue)
  // 注册Vue.extend() 基于传入的options,返回一个组件的构造函数
  initExtend(Vue)
  // 注册Vue.directive(), Vue.component(), Vue.filter()
  initAssetRegisters(Vue)
  console.log('End------>initGlobalAPI')
}
