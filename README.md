---
theme: juejin
---
# 前言
随着逆virtualdom的潮流的到来，vue也即将推出vapor mode，是时候研究一下svelte这个NoVirtualDOM的先驱者框架了。

通过本篇文章，你将学到：
- 大佬眼中的响应式编程&轻微diss reactjs
- 脱离虚拟节点的高性能模块化响应式代码编写（参照svelte编译产物）
- svelte要编译的是哪一部分

# What is Reactive Programming

> the essense of functional reactive programing is to specify the dynamic behavior of a value completely at the time of declaration
> 
> Reactive Programming的本质是在声明时完全指定一个值的动态行为
>
> -- *Heinrich Apfelmus 一个大佬* 

## Best Reactive Programing： excel

单元格C1输入`=A1+B1`
![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/27179c3a0b2044d792ea02a18d136576~tplv-k3u1fbpfcp-watermark.image?)

输出的结果就是3
![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e9bec25cac3543cba10cfa3655e7a58e~tplv-k3u1fbpfcp-watermark.image?)

且当A1和B1的内容发生变化后，C1的值发生相应的变化

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/73b32b4b1f6344359f80b7d02c6b7a97~tplv-k3u1fbpfcp-watermark.image?)

这种响应式的模式非常受包括vue作者、svelte作者在内的大佬们的推崇，也是各个前端框架努力接近的目标。

## reactjs：有争议的响应式编程
> "React" is a terrible name for @reactjs
> -- by John Lindquist（Kit的作者）

reactjs将真实节点与虚拟节点绑定，通过手动触发组件的render方法，重新生成虚拟节点，又通过新旧虚拟节点的diff，确定了真实节点的操作。这个过程看起来就像是响应式，开发人员避开了直接操作dom节点，而是专注于操作数据，但是在实际开发过程中，reactjs并没有那么响应式，以下几个例子将会说明这一点。

- 数据有时候不是最新的

```js
// 测试3s内用户点击按钮次数
import { useState } from 'react'
export default function App() {
    const [count, setCount] = useState(0);
    const click = () => {
        if (count === 0) {
            setTimeout(() => {
                window.alert(count);
                setCount(0);
            }, 3000)

        }
        setCount(count + 1);
    }
    return (
        <button onClick={click}>点击{count}</button>
    )
}
```
按照响应式的思路，点击的时候改变count变量的值，3s后弹窗显示count最新的值，但是上诉代码执行结果始终弹出0

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea91b3a2504641c78591e358c226f3aa~tplv-k3u1fbpfcp-watermark.image?)

原因是：react fc每次渲染的时候，useState都会生成新的数组，而setTimeout中使用的count属于旧数组的内容。

```js
// 正确的写法
// 测试3s内用户点击按钮次数
import { useState } from 'react'
export default function App() {
    const [count, setCount] = useState(0);
    const click = () => {
        if (count === 0) {
            setTimeout(() => {
                // dispatcher支持函数式写法，参数为最新值
                setCount(val => {
                    window.alert(val);
                    return 0;
                });
            }, 3000)

        }
        setCount(count + 1);
    }
    return (
        <button onClick={click}>点击{count}</button>
    )
}
```

> react hooks的这种写法违反了响应式编程的直觉，有了额外的理解负担，与此类似还有其他一些特殊场景，这里就不展开了。

- 需要考虑性能

React团队觉得VirtualDOM够快了吗？答案是否定的。可以从官方提供的多种性能优化手段可以看出：

- 减少渲染次数和内存消耗
    - shouldComponentUpdate
    - React.PureComponent
    - useMemo
    - useCallback
- 均摊渲染压力，减少长任务
    - cocurrent模式

> 响应式编程应该像excel一样，仅考虑功能上的设计，而性能明显超纲了。

# 脱离VirtualDOM实现响应式编程

> 需求描述：使用js生成一个button，button里面绑定了一个count属性，点击一次count+1，button的内容页发生相应变化
> 
![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/92fc3467590f43ae8e545b2d7b5d124e~tplv-k3u1fbpfcp-watermark.image?)

## 简单的思路
暴露一个api用来改变count属性，同时修改button内的textContent属性
```js
function reactiveButton() {
  let count = 0;
  const button = document.createElement('button');
  function renderButton() {
      button.textContent = `count is ${count}`;
  }

  function setCount() {
      count ++;
      renderButton();
  }
  
  button.onclick = setCount;

  renderButton();
  
  return button
}

const button = reactiveButton();
document.body.appendChild(button);
```
## 操作颗粒度更细分

上面代码的操作颗粒度是按钮，举一个极端例子，按钮的内容是前面一万多个字符，然后在跟着一个count的值，当变更count并且执行renderButton的时候，会对整个按钮的文案进行操作。但是如果我们把count改变操作对象从button改为textNode，那就轻松多了。

```js
function reactiveButton() {
  let count = 0;
  const button = document.createElement('button');
  // 为count和之前的文本各自创建TextNode元素
  const t1 = document.createTextNode('count is ');
  const t2 = document.createTextNode(count);
  button.appendChild(t1);
  button.appendChild(t2);
  // 颗粒度改为直接操作count直接影响的TextNode元素
  function renderTextNode() {
      t2.textContent = count;
  }

  function setCount() {
      count ++;
      renderTextNode();
  }
  
  button.onclick = setCount;
  return button
}
```

## 分离dom操作和变量赋值


之前变量变化后要紧跟着对应dom的变化，这个和响应式编程的理念违背，即定义变量的时候就应该确定变量会导致的变化，而上面代码跟在`count ++`后的代码就是`t2.textContent = count`，数据与dom操作没有解耦

我们期待数据操作和dom操作是区分开的
```js
// 数据的定义的操作
function instance() {
    let count = 0;
    function setCount() {
      count ++;
    }
    return [count, setCount]
}
```

```js
// 创建组件实例，返回dom的操作封装
function create_fragment(target = document.body, ctx) {
    let count = 0;
    let button
    let t1;
    let t2;
    let mounted = false;
    return {
        // 元素的初始化
        create() {
            button = document.createElement('button');
            t1 = document.createTextNode('count is ');
            t2 = document.createTextNode(ctx[0]);
        },
        // 元素的插入操作
        // target表示父元素，anchor表示锚点元素
        // 如果anchor存在，则插入到anchor之前，如果不存在，则作为父元素的最后一个子元素
        mount(target, anchor) {
            button.appendChild(t1);
            button.appendChild(t2);
            target.insertBefore(button, anchor || null);
            
            if (!mounted) {
              mounted = true;
              button.onclick = () => {
                  // 点击后触发上下文对象中暴露的函数
                  ctx[1].call();
                  this.update();
              }
            }
        },
        
        // 更新节点，因为只有t2的文本节点需要更新，且收到上下文对象中的count影响
        function update() {
            t2.textContent = ctx[0]
        }
    }
}
```

```js
// 分别初始化dom和定义影响dom的变量
const ctx = instance();
const b = create_fragment(ctx);
b.create();
b.mount(document.body, null);
```

通过上诉的方式，确实页面确实显示出了一个按钮，且按钮内容为预期中的`count is 0`，但是点击后内容没有发生变化，原因是返回的`ctx[1]`函数改的是函数内作用域的`count`，并不是暴露出去的`ctx[0]`。

## 维护一个上下文数组和改变内容的方法

为了解决上诉问题，需要改变一下上下文数组初始化的写法

```diff
function instance(
+    $$invalidate // 初始化的时候传入一个可以有效改变上下文数组的函数
) {
  let count = 0;
  const setCount = () => {
-    count ++;
+    $$invalidate(0, count ++)
  }

  return [count, setCount]
}
```

```diff
// 维护一个上下文数组和改变上下文对象的方法
- const ctx = instance();
+ const $$ = {};
+ $$.ctx = instance((i, val) => {
+  $$.ctx[i] = val;
+})
const b = create_fragment(
-    ctx
+    $$.ctx
);
```

> 这样处理后确实点击内容会发生变化，但是很奇怪，点击第一次的时候，没有发生变化
> （如下所示）

![a7acp-j73o6.gif](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fea4594cec6649b0b382826d5882395d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1280&h=416&e=gif&f=144&b=ffffff)
原因：count ++这类的语法，是会先返回count，然后再进行+1操作，例如：
```js
let a = 1;
const b = a ++;
// 这时候打印的还是1
console.log(b)
```

解决方案：不可能去改count++的常用写法，添加传参让用户传入最新的count值
```diff
function instance($$invalidate) {
  let count = 0;
  const setCount = () => {
    $$invalidate(
        0,
        count ++,
+       count
    )
  }

  return [count, setCount]
}
```

```diff
const $$ = {};
$$.ctx = instance((
    i,
    val,
+   ...res
) => {
-  $$.ctx[i] = val
+  $$.ctx[i] = rest.length ? res[0] : val;
})
```
执行后，发现问题已经解决

## 多个变量，阁下又该如何应对？

> 修改需求：页面上添加一个文本内容，显示count是否超过3了
> 

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f11a143d0e09400da52ebaa92c1874e1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=416&h=74&e=png&b=f6f6f6)

简单的想法：对外抛出一个`isMoreThan3`变量，setCount方法执行的时候同时去改`count`和`isMoreThan3`的值

```diff
function instance($$invalidate) {
  let count = 0;
+ let isMoreThan3 = count > 3;
  const setCount = () => {
    $$invalidate(0, count ++, count)
+   $$invalidate(2, count > 3)
  }

  return [
      count,
      setCount,
+     isMoreThan3,
  ]
}
```
同时进行之前类似的元素封装处理：create方法添加两个文本节点，mount方法插入两个文本节点，update方法改变绑定`isMoreThan3`的文本节点

```diff
// 创建节点
function create() {
    button = document.createElement('button');
    t1 = document.createTextNode('count is ');
    t2 = document.createTextNode(ctx[0]);
+   t3 = document.createTextNode(' is more than 3: ');
+   t4 = document.createTextNode(ctx[2])
}

// 插入节点
function mount(target, anchor) {
    button.appendChild(t1);
    button.appendChild(t2);
+   button.appendChild(t3);
+   button.appendChild(t4);
    target.insertBefore(button, anchor || null);

    if (!mounted) {
      mounted = true;
      button.onclick = () => {
        ctx[1].call();
        this.update();
      }
    }
}

// 更新节点
function update() {
    t2.textContent = ctx[0]
+   t4.textContent = ctx[2]
}
```

达到效果：

![jmsj5-7nfgj.gif](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f53e876d4b4451ab0a1f257321066d9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=456&h=116&e=gif&f=186&b=fbfbfb)

## 响应式的门槛：由`count`计算出`isMoreThan3`

>还记得之前我们提响应式编程的最佳模版excel吗？目前遇到的情况很像excel的单元格互相影响的情形，响应式编程应该**尽量去建立数据间的联系**，而不是相对独立的去更改有关系的数据。

思路：流程中，在更新dom之前增加一环只执行一次的计算属性的赋值操作

所以先理一下目前为止的流程：

![svelte.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f7b53c2a140c4ed1ac32bbeffdbbb84e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=485&h=1282&e=png&a=1&b=fcfcfc)

在这个流程中我们发现ctx和fragment有直接的调用，这个就和我们的响应式编程的理念不一致，我们需要的是：数据变化 => 引起dom自动发生变化，而流程中dom的变化还是dom本身的封装代码。

修改一下流程，同时加入计算属性的赋值：

![svelte (1).png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1fbcaecb346949ffb1664c949abc4747~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=625&h=1746&e=png&a=1&b=fcfcfc)

代码实现：
```diff
function instance(
+ $$,
  $$invalidate
) {
  let count = 0;
  const setCount = () => {
    $$invalidate(0, count ++, count)
  }
  let isMoreThan3;
+ // 计算属性的赋值方法
+ $$.update = () => {
+   $$invalidate(2, count > 3)
+ }

  return [count, setCount, isMoreThan3]
}
```

```js
let promise = Promise.resolve();
// 定义本次dom更新是否已经开始
let update_scheduled = false;

// 每次invalidate都会调用的方法
// 使用promise确保在所有变量赋值操作结束后执行一次dom的update操作
function update($$) {
  if (!update_scheduled) {
    update_scheduled = true;
    $$.update();
    // 执行其他的字段更新，也就是之前isMoreThan3的计算
    promise = Promise.resolve().then(() => {
      // 进行dom的修改操作
      $$.fragment?.update();
      update_scheduled = false
    })
  }
}
```

```diff
const $$ = {};
+ $$.update = () => {}; // 设置默认值
$$.ctx = instance(
+ $$,
  (i, ret, ...res) => {
    $$.ctx[i] = res.length ? res[0] : ret;
    update($$);
  }
)
+ $$.update(); // 在创建dom封装之前进行计算属性的赋值
const c = create_fragment($$.ctx);
+ $$.fragment = c; // 赋值到$$下方便update函数调用
c.create();
c.mount(document.body, null);
```
执行结果：符合预期。

![jmsj5-7nfgj.gif](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f53e876d4b4451ab0a1f257321066d9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=456&h=116&e=gif&f=186&b=fbfbfb)

## diff减少dom操作次数

上诉动图中，点击了4次按钮，创建的t4文本节点也更新了4次，实际上，在前3次点击的时候，t4不需要发生变动。

简单的思路：维护一个大于ctx长度的dirty数组，表示每一个上下文变量是否发生改变

```diff
  // create_fragment封装的更新dom的方法
  function update(
+     dirty
  ) {
+   if (dirty[0]) {
+     console.log('update t2') // 测试代码，观察t2节点有没有发生dom操作
      t2.textContent = ctx[0]
+   }
+   if (dirty[2]) {
+     console.log('update t4') // 测试代码，观察t4节点有没有发生dom操作
      t4.textContent = ctx[2]
+   }
  }
```
```diff
function update($$) {
  if (!update_scheduled) {
    update_scheduled = true;
    $$.update();
    // 执行其他的字段更新，也就是之前isMoreThan3的计算
    promise = Promise.resolve().then(() => {
      $$.fragment?.update($$.dirty);
      update_scheduled = false
+     $$.dirty = new Array(10000).fill(0);
    })
  }
}
```
```diff
const $$ = {};
$$.update = () => {};
+ $$.dirty = new Array(10000).fill(0); // 定义一个远超ctx长度的数组
$$.ctx = instance($$, (i, ret, ...res) => {
  const oldVal = $$.ctx[i];
  $$.ctx[i] = res.length ? res[0] : ret;
  if (oldVal !== $$.ctx[i]) {
    $$.dirty[i] = 1;
  }
  update($$);
})
$$.update();
const c = create_fragment($$.ctx);
$$.fragment = c;
c.create();
c.mount(document.body, null);
+ $$.dirty = new Array(10000).fill(0); // 初次渲染后，防止计算属性导致的dirty赋值
```

效果：只有在点击第4次的时候才会去更新t4节点，符合预期

![089e8-k8rqz.gif](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2afa3f036f0f429c90fc25e06cf01ccf~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=444&h=738&e=gif&f=297&b=fdfdfd)


细心的同学们肯定发现了，这种方式比较消耗内存，有没有比较好的方式来解决？

对于这种状态位的变更，二进制看起来是不错的选择。

```js
// 0: 没有一位发生变化
// 01: 表示只有ctx[0]发生变化
// 11: 表示只有ctx[0]和ctx[1]发生变化
// 10: 表示只有ctx[1]发生变化
// 如何得到第0位变化的dirty值
0 | 1 << 0
// 00 | 01的操作，结果为01
1 | 1 << 1
// 01 | 10的操作，结果为11
// 以此类推
// dirty |= 1 << i 表示得到第i位发生变化的掩码 
// 位数过长时（超过0~31位的范围），复用之前的位数
// dirty |= 1 << i % 31

// 如何判断第i位数字是1的公式：
0 & 1 << 0
// 0 & 1结果为0，表示第0位是不变的
2 & 1 << 0
// 11 & 01 结果为11，表示第0位发生了变化
// 以此类推
// dirty & (1 << i) 表示第i位是否发生了变化
```

```diff
  // create_fragment封装的更新dom的方法
  function update(
      dirty
  ) {
-   if (dirty[0]) {
+   if (dirty & 1 << 0) {
      console.log('update t2') // 测试代码，观察t2节点有没有发生dom操作
      t2.textContent = ctx[0]
    }
-   if (dirty[2]) {    
+   if (dirty & 1 << 2) {
      console.log('update t4') // 测试代码，观察t4节点有没有发生dom操作
      t4.textContent = ctx[2]
    }
  }
```

```diff
function update($$) {
  if (!update_scheduled) {
    update_scheduled = true;
    $$.update();
    // 执行其他的字段更新，也就是之前isMoreThan3的计算
    promise = Promise.resolve().then(() => {
      $$.fragment?.update($$.dirty);
      update_scheduled = false
-     $$.dirty = new Array(10000).fill(0);
+     $$.dirty = 0;
    })
  }
}
```

```diff
const $$ = {};
$$.update = () => {};
- &&.dirty = new Array(10000).fill(0)
+ $$.dirty = 0;
$$.ctx = instance($$, (i, ret, ...res) => {
  const oldVal = $$.ctx[i];
  $$.ctx[i] = res.length ? res[0] : ret;
  if (oldVal !== $$.ctx[i]) {
-   $$.dirty[i] = 1;
+   $$.dirty |= 1 << (i % 31)
  }
  update($$);
})
$$.update();
const c = create_fragment($$.ctx);
$$.fragment = c;
c.create();
c.mount(document.body, null);
$$.dirty = 0;
```

## 抽离容器代码

之前写死了一个容器body，但是在实际使用的时候，应该要允许用户自定义容器
```diff
+class Demo1 {
+  constructor(props) {
    const $$ = {};
    $$.update = () => {};
    $$.dirty = 0;
    $$.ctx = instance($$, (i, ret, ...res) => {
      const oldVal = $$.ctx[i];
      $$.ctx[i] = res.length ? res[0] : ret;
      if (oldVal !== $$.ctx[i]) {
        console.log($$.dirty, i, 'before')
        $$.dirty |= 1 << (i % 31)
        console.log($$.dirty, 'after')
      }
      update($$);
    })
    $$.update();
    const c = create_fragment($$.ctx);
    $$.fragment = c;
    c.create();
-   c.mount(document.body, null);
+   c.mount(props.target, props.anchor);
    $$.dirty = 0;
+  }
+}

+ new Demo1({target: document.body});
```

## vs React
同样的按钮点击功能，react代码为
```jsx
import React, { useState } from 'react'
import ReactDOM from 'react-dom'

function Demo1() {
    const [count, setCount] = useState();
    
    return (
        <button onClick={() => setCount(val => val + 1)}>
            count is {count} is more than 3: { count > 3 }
        </button>
    )
}

ReactDOM.createRoot(document.body).render(Demo1);
```
这时候能感觉出虚拟节点的优势了，相同功能，从100行代码缩减到10行。但是从资源加载大小来讲，react额外加载50kb左右的资源（gzip之后），而这里的100行代码，只有2.6kb大小（gzip之前）

而从性能上看，无虚拟节点的demo，避免了复杂的树形数据和其复杂的比较过程，操作颗粒度细到极致，性能必定是远高于react的。


|  | 代码复杂度 | 打包体积 | 性能 |
| --- | --- | --- | --- |
| react | 简单 | 大 |  有优化空间 |
| 无虚拟节点 | 复杂 | 小| 很好 |

> 看起来，脱离虚拟节点来写响应式前端代码，除了代码复杂度比较高之外，其他的都比较不错。

# 救星：svelte

那么辛苦写了响应式的纯js代码，其实也是为了接近svelte最终编译的结果，让我们看一下同样功能的svelte代码是怎么写的:

```html
<script>
  let count = 0
  const increment = () => {
    count ++
  }
  $: isMoreThan3 = count > 3;
</script>

<button on:click={increment}>
  count is {count} is more than 3: {isMoreThan3}
</button>
```
也是寥寥几行代码也是可以解决，svelte将会将这样的代码编译成类似于上面的代码。

|  | 代码复杂度 | 打包体积 | 性能 |
| --- | --- | --- | --- |
| react | 简单 | 大 |  有优化空间 |
| svelte | 简单 | 小| 很好 |

# 总结

本篇文章，我们实现了无虚拟节点下高性能js实现方案，这里参照了svelte编译后的js产物，对理解svelte的响应式原理有很大的帮助。众所周知，svelte是一个重编译的框架，而通过我们手写的编译后产物，我们可以知道哪些是需要编译的，哪些是可以抽离出来的工具函数。下一篇我们将针对性地实现部分功能的编译。

> 参考资料：
> - 完整示例代码：
> - svelte源码位置
>   - /packages/svelte/src/runtime/internal （定义了编译后产物用到的工具函数和容器）

