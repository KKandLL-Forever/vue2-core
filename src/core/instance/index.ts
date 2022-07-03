import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import type { GlobalAPI } from 'types/global-api'

console.log('------------------instance/index.ts')
// 此处不用 class 的原因是因为方便后续给 Vue 实例混入实例成员
function Vue(options) {
  console.log('Start---->执行new')
  if (__DEV__ && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
  console.log('End------>new')
}

// 注册Vue原型上的 _init() 方法，初始化 vm
//@ts-expect-error Vue has function type
initMixin(Vue)

// 注册跟数据相关的 $data/$props/$set/$delete/$watch
//@ts-expect-error Vue has function type
stateMixin(Vue)

// 初始化跟事件相关方法 $on/$once/$off/$emit
//@ts-expect-error Vue has function type
eventsMixin(Vue)

// 初始化生命周期相关的混入方法 _update/$forceUpdate/$destroy
//@ts-expect-error Vue has function type
lifecycleMixin(Vue)

// 混入渲染相关的函数 $nextTick/_render
//@ts-expect-error Vue has function type
renderMixin(Vue)

console.log(Vue)
export default Vue as unknown as GlobalAPI
