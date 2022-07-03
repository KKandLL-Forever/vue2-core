import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'
import { isArray, isFunction } from 'shared/util'

import { ASSET_TYPES, LIFECYCLE_HOOKS } from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'
import type { Component } from 'types/component'
import type { ComponentOptions } from 'types/options'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (__DEV__) {
  strats.el = strats.propsData = function (
    parent: any,
    child: any,
    vm: any,
    key: any
  ) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
          'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData(
  to: Record<string | symbol, any>,
  from: Record<string | symbol, any> | null
): Record<PropertyKey, any> {
  if (!from) return to
  let key, toVal, fromVal

  // Reflect.ownKeys可以拿到Symbol属性
  const keys = hasSymbol
    ? (Reflect.ownKeys(from) as string[])
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      //子的数据父没有，则将新增的数据加入响应式系统中
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      // 处理深层对象，当合并的数据为多层嵌套对象时，需要递归调用mergeData进行比较合并
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn(
  parentVal: any,
  childVal: any,
  vm?: Component
): Function | null {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      // 子类不存在data选项，则合并结果为父类data选项
      return parentVal
    }
    if (!parentVal) {
      // 父类不存在data选项，则合并结果为子类data选项
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // data选项在父类和子类同时存在的情况下返回的是 一个函数
    return function mergedDataFn() {
      return mergeData(
        // 子类实例和父类实例，分别将子类和父类实例中data函数执行后返回的对象传递给mergeData 函数做数据合并
        isFunction(childVal) ? childVal.call(this, this) : childVal,
        isFunction(parentVal) ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    // Vue实例
    return function mergedInstanceDataFn() {
      // instance merge
      const instanceData = isFunction(childVal)
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = isFunction(parentVal)
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        // 当实例中传递data选项时，将实例的data对象和Vm构造函数上的data属性选项合并
        return mergeData(instanceData, defaultData)
      } else {
        // 当实例中不传递data时，默认返回Vm构造函数上的data属性选项
        return defaultData
      }
    }
  }
}

// data的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): Function | null {
  if (!vm) {
    // vm代表是否为Vue创建的实例，否则是子父类的关系
    if (childVal && typeof childVal !== 'function') {
      // 必须保证子类的data类型是 一个函数而不是一个对象
      __DEV__ &&
        warn(
          'The "data" option should be a function ' +
            'that returns a per-instance value in component ' +
            'definitions.',
          vm
        )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  // vue实例时需要传递vm作为函数的第 三个参数
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
export function mergeLifecycleHook(
  parentVal: Array<Function> | null,
  childVal: Function | Array<Function> | null
): Array<Function> | null {
  // 1.如果子类和父类都拥有钩子选项，则将子类选项和父类选项合并,
  // 2.如果父类不存在钩子选项，子类存在时，则以数组形式返回子类钩子选项，
  // 3.当子类不存在钩子选项时，则以父类选项返回。
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : isArray(childVal)
      ? childVal
      : [childVal]
    : parentVal
  return res ? dedupeHooks(res) : res
}
// 防止多个组件实例钩子选项相互影响
function dedupeHooks(hooks: any) {
  const res: Array<any> = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeLifecycleHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets(
  parentVal: Object | null,
  childVal: Object | null,
  vm: Component | null,
  key: string
): Object {
  // 创建一个空对象，其原型指向父类的资源 选项。
  const res = Object.create(parentVal || null)
  if (childVal) {
    // components,filters,directives选项必须为对象
    __DEV__ && assertObjectType(key, childVal, vm)
    // 子类选项赋值给空对象
    return extend(res, childVal)
  } else {
    return res
  }
}

// 定义资源合并的策略
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})// 定义默认策略

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
//最终和父类选项合并成数组，并且数组的选项成员，可以是回 调函数，选项对象，或者函数名。
strats.watch = function (
  parentVal: Record<string, any> | null,
  childVal: Record<string, any> | null,
  vm: Component | null,
  key: string
): Object | null {
  // work around Firefox's Object.prototype.watch...
  //@ts-expect-error work around
  if (parentVal === nativeWatch) parentVal = undefined
  //@ts-expect-error work around
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (__DEV__) {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret: Record<string, any> = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent ? parent.concat(child) : isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
//如果父类不存在选项，则返回子类选项，子类父类都存在时，用子类选项去覆盖父类选项。
strats.props =
  strats.methods =
  strats.inject =
  strats.computed =
    function (
      parentVal: Object | null,
      childVal: Object | null,
      vm: Component | null,
      key: string
    ): Object | null {
      if (childVal && __DEV__) {
        assertObjectType(key, childVal, vm)
      }
      if (!parentVal) return childVal
      const ret = Object.create(null)
      extend(ret, parentVal)
      if (childVal) extend(ret, childVal)
      return ret
    }
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined ? parentVal : childVal
}

/**
 * Validate component names
 */
// components规范检查函数
function checkComponents(options: Record<string, any>) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName(name: string) {
  if (
    // 正则判断检测是否为非法的标签，例如数字开头
    !new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)
  ) {
    warn(
      'Invalid component name: "' +
        name +
        '". Component names ' +
        'should conform to valid custom element name in html5 specification.'
    )
  }
  // 不能使用Vue自身自定义的组件名，如slot, component,不能使用html的保留标签，如 h1, svg等
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
        'id: ' +
        name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps(options: Record<string, any>, vm?: Component | null) {
  // props选项数据有两种形式:
  // 一种是['a', 'b', 'c']
  // 一种是{ a: { type: 'String', default: 'hello' }}
  const props = options.props
  if (!props) return
  const res: Record<string, any> = {}
  let i, val, name
  // 数组
  if (isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        // 默认将数组形式的props转换为对象形式。
        res[name] = { type: null }
      } else if (__DEV__) {
        // 规则:保证是字符串
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val) ? val : { type: val }
    }
  } else if (__DEV__) {
    // 非数组，非对象则判定props选项传递非法
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
        `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject(options: Record<string, any>, vm?: Component | null) {
  const inject = options.inject
  if (!inject) return
  const normalized: Record<string, any> = (options.inject = {})
  //数组的形式
  if (isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      // from: 属性是在可用的注入内容中搜索用的 key (字符串或 Symbol)
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    // 对象的处理
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (__DEV__) {
    // 非法规则
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
        `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives(options: Record<string, any>) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      // 函数简写同样会转换成对象的形式
      if (isFunction(def)) {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType(name: string, value: any, vm: Component | null) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
        `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
export function mergeOptions(
  parent: Record<string, any>,
  child: Record<string, any>,
  vm?: Component | null
): ComponentOptions {
  if (__DEV__) {
    checkComponents(child)
  }

  if (isFunction(child)) {
    // @ts-expect-error
    child = child.options
  }

  // props,inject,directives的校验和规范化
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  // 针对extends扩展的子类构造器
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options: ComponentOptions = {} as any
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField(key: any) {
    // 拿到各个选择指定的选项配置，如果没有则用默认的配置
    const strat = strats[key] || defaultStrat
    // 执行各自的合并策略
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset(
  options: Record<string, any>,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (__DEV__ && warnMissing && !res) {
    warn('Failed to resolve ' + type.slice(0, -1) + ': ' + id, options)
  }
  return res
}
