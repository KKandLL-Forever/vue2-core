import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref
} from './util/compat'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'

console.log('------------------runtime-with-compiler.ts')
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})
//保存 Vue.prototype.$mount 方法
const mount = Vue.prototype.$mount
//相比runtime/index.ts中的$mount新增将template编译成render函数的部分
Vue.prototype.$mount = function (
  el?: string | Element,
  // 非ssr时为false，反之为true
  hydrating?: boolean
): Component {
  // console.log('runtime-with-compiler内定义$mount----------------Start')
  //获取el对象
  el = el && query(el)

  /* istanbul ignore if */
  // el 不能是body 或者 html
  if (el === document.body || el === document.documentElement) {
    __DEV__ &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function

  //如果没有传入render函数，将template转换成render函数
  //如果传入了render函数，直接调用下面的mount方法
  if (!options.render) {
    // 把 template/el 转换成 render 函数
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        // 如果模板是 id 选择器 例如：
        // new Vue({
        //  template: '#demo'
        // })
        if (template.charAt(0) === '#') {
          // 获取对应的 DOM 对象的 innerHTML
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (__DEV__ && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        console.log(template,'wo shi yuansu ssssssssss')
        // 如果模板是元素，返回元素的 innerHTML
        template = template.innerHTML
      } else {
        if (__DEV__) {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // @ts-expect-error
      // 如果没有 template，获取el的 outerHTML 作为模板
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (__DEV__ && config.performance && mark) {
        mark('compile')
      }

      // 把 template 转换成 render 函数
      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: __DEV__,
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments
        },
        this
      )
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (__DEV__ && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // console.log('runtime-with-compiler内定义$mount----------------End')
  //调用 mount 方法，渲染 DOM
  //这的mount()方法是在runtime/index.ts中保存的$mount()方法
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue as GlobalAPI
