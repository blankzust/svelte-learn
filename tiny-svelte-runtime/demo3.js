// 数据的定义的操作
function instance($$, $$invalidate) {
  let count = 0;
  let isMoreThan3 = false;
  function setCount() {
    // count ++;
    $$invalidate(0, count ++, count)
    // $$invalidate(2, count > 3)
  }
  $$.update = () => {
    $$invalidate(2, count > 3)
  }
  return [count, setCount, isMoreThan3]
}

// 创建组件实例，返回dom的操作封装
function create_fragment(target = document.body, ctx) {
  let count = 0;
  let button
  let t1;
  let t2;
  let t3;
  let t4;
  let mounted = false;
  return {
      // 元素的初始化
      create() {
          button = document.createElement('button');
          t1 = document.createTextNode('count is ');
          t2 = document.createTextNode(ctx[0]);
          t3 = document.createTextNode(' is more than 3:');
          t4 = document.createTextNode(ctx[2]);
      },
      // 元素的插入操作
      // target表示父元素，anchor表示锚点元素
      // 如果anchor存在，则插入到anchor之前，如果不存在，则作为父元素的最后一个子元素
      mount(target, anchor) {
          button.appendChild(t1);
          button.appendChild(t2);
          button.appendChild(t3);
          button.appendChild(t4);
          target.insertBefore(button, anchor || null);
          
          if (!mounted) {
            mounted = true;
            button.onclick = () => {
                // 点击后触发上下文对象中暴露的函数
                ctx[1].call();
                // this.update();
            }
          }
      },
      
      // 更新节点，因为只有t2的文本节点需要更新，且收到上下文对象中的count影响
      update(dirty) {
          
          if (dirty & 1 << 0) {
            console.log('update t2')
            t2.textContent = ctx[0]
          }
          if (dirty & 1 << 2) {
            console.log('update t4')
            t4.textContent = ctx[2]
          }
      }
  }
}

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
      $$.fragment?.update($$.dirty);
      update_scheduled = false;
      $$.dirty = new Array(10000).fill(0);
    })
  }
}

const $$ = {};
const dirty = 0;
$$.dirty = dirty;

// ctx[i]有没有发生变化
// 100 & dirty === 0

// 1 << 0 只有0位是1 1
// 1 << 1 只有1位是1 10 2

// dirty掩码

// 00
// 10
// 10
// 01
// 11

$$.ctx = instance($$, (i, val, ...res) => {
  const oldVal = $$.ctx[i];
  $$.ctx[i] = res.length > 0 ? res[0] : val;
  if (oldVal !== $$.ctx[i]) {
    $$.dirty |= 1 << i;
  }
  update($$);
});
const fragment = create_fragment(document.body, $$.ctx);
$$.fragment = fragment;
fragment.create()
fragment.mount(document.body);
$$.dirty = new Array(10000).fill(0); // 初次渲染后，防止计算属性导致的dirty赋值