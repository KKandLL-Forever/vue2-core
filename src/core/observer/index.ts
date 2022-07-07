import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  isArray,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
  hasChanged
} from '../util/index'
import { isReadonly, isRef, TrackOpTypes, TriggerOpTypes } from '../../v3'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

const NO_INIITIAL_VALUE = {}

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  // 管理依赖的Dep类
  dep: Dep
  // 实例计数器
  vmCount: number // number of vms that have this object as root $data

  constructor(public value: any, public shallow = false) {
    // this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 将实例挂载到观察对象的 __ob__ 属性
    def(value, '__ob__', this)
    // 数组的响应式处理
    if (isArray(value)) {
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      if (!shallow) {
        this.observeArray(value)
      }
    } else {
      // 遍历对象中的每一个属性，转换成 setter/getter
      this.walk(value, shallow)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk(obj: object, shallow: boolean) {
    // 获取观察对象的每一个属性
    const keys = Object.keys(obj)
    // 遍历每一个属性，设置为响应式数据
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      defineReactive(obj, key, NO_INIITIAL_VALUE, undefined, shallow)
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(value: any, shallow?: boolean): Observer | void {
  // 判断 value 是否是对象
  if (!isObject(value) || isRef(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果 value 有 __ob__(observer对象) 属性
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value.__v_skip //如果是vue实例不需要响应式处理
  ) {
    // 创建一个 Observer 对象
    ob = new Observer(value, shallow)
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive(
  obj: object,
  key: string,
  val?: any,
  customSetter?: Function | null,
  shallow?: boolean //是否为基础类型
) {
  // 创建依赖对象实例
  const dep = new Dep()

  // 获取 obj 的属性描述符对象
  // getOwnPropertyDescriptor返回如下结构：
  // {
  //   "value": 100,
  //   "writable": true,
  //   "enumerable": true,
  //   "configurable": true
  // }
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    // 属性必须满足可配置
    return
  }

  // cater for pre-defined getter/setters
  // 提供预定义的存取器函数, 也就是用户对obj自定义的getter和setter
  const getter = property && property.get
  const setter = property && property.set
  if (
    (!getter || setter) &&
    (val === NO_INIITIAL_VALUE || arguments.length === 2)
  ) {
    //只传了2个参数时，直接获取value
    val = obj[key]
  }

  // 判断是否递归观察子对象，并将子对象属性都转换成 getter/setter，返回子观察对象
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      // 如果预定义的 getter 存在则 value 等于getter 调用的返回值
      // 否则直接赋予属性值
      const value = getter ? getter.call(obj) : val
      // 如果存在当前依赖目标，即 watcher 对象，则建立依赖
      if (Dep.target) {
        if (__DEV__) {
          dep.depend({
            target: obj,
            type: TrackOpTypes.GET,
            key
          })
        } else {
          dep.depend()
        }
        // 如果子观察目标存在，建立子对象的依赖关系
        if (childOb) {
          childOb.dep.depend()
          // 如果属性是数组，则特殊处理收集数组对象依赖
          if (isArray(value)) {
            dependArray(value)
          }
        }
      }
      return isRef(value) ? value.value : value
    },
    set: function reactiveSetter(newVal) {
      // 如果预定义的 getter 存在则 value 等于getter 调用的返回值
      // 否则直接赋予属性值
      const value = getter ? getter.call(obj) : val
      // 如果新值等于旧值或者新值旧值为NaN则return
      if (!hasChanged(value, newVal)) {
        return
      }
      if (__DEV__ && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else if (getter) {
        // #7981: for accessor properties without setter
        return
      } else if (isRef(value) && !isRef(newVal)) {
        value.value = newVal
        return
      } else {
        val = newVal
      }
      // 如果新值是对象，观察子对象并返回 子的 observer 对象
      childOb = !shallow && observe(newVal)
      if (__DEV__) {
        dep.notify({
          type: TriggerOpTypes.SET,
          target: obj,
          key,
          newValue: newVal,
          oldValue: value
        })
      } else {
        dep.notify()
      }
    }
  })

  return dep
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set<T>(array: T[], key: number, value: T): T
export function set<T>(object: object, key: string | number, value: T): T
export function set(
  target: any[] | Record<string, any>,
  key: any,
  val: any
): any {
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  if (isReadonly(target)) {
    __DEV__ && warn(`Set operation on key "${key}" failed: target is readonly.`)
    return
  }
  if (isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target as any).__ob__
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid adding reactive properties to a Vue instance or its root $data ' +
          'at runtime - declare it upfront in the data option.'
      )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  if (__DEV__) {
    ob.dep.notify({
      type: TriggerOpTypes.ADD,
      target: target,
      key,
      newValue: val,
      oldValue: undefined
    })
  } else {
    ob.dep.notify()
  }
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del<T>(array: T[], key: number): void
export function del(object: object, key: string | number): void
export function del(target: any[] | object, key: any) {
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  if (isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target as any).__ob__
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid deleting properties on a Vue instance or its root $data ' +
          '- just set it to null.'
      )
    return
  }
  if (isReadonly(target)) {
    __DEV__ &&
      warn(`Delete operation on key "${key}" failed: target is readonly.`)
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  if (__DEV__) {
    ob.dep.notify({
      type: TriggerOpTypes.DELETE,
      target: target,
      key
    })
  } else {
    ob.dep.notify()
  }
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    if (e && e.__ob__) {
      e.__ob__.dep.depend()
    }
    if (isArray(e)) {
      dependArray(e)
    }
  }
}
