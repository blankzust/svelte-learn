function instance($$, $$invalidate) {
  let count = 0;
  const setCount = () => {
    // count ++;
    $$invalidate(0, count ++, count)
  }
  let isMoreThan3;

  $$.update = () => {
    $$invalidate(2, count > 3)
  }

  return [count, setCount, isMoreThan3]
}

function create_fragment(ctx) {
  let button
  let t1;
  let t2;
  let t3;
  let t4;
  let mounted = false;

  // 创建节点
  function create() {
    button = document.createElement('button');
    t1 = document.createTextNode('count is ');
    t2 = document.createTextNode(ctx[0]);
    t3 = document.createTextNode(' is more than 3: ');
    t4 = document.createTextNode(ctx[2])
  }

  // 插入节点
  function mount(target, anchor) {
    button.appendChild(t1);
    button.appendChild(t2);
    button.appendChild(t3);
    button.appendChild(t4);
    target.insertBefore(button, anchor || null);

    if (!mounted) {
      mounted = true;
      button.onclick = () => {
        ctx[1].call();
      }
    }
  }
  
  // 更新节点
  function update(dirty) {
    console.log(dirty, 'dirty')
    if (dirty & (1 << 0)) {
      console.log('update t2')
      t2.textContent = ctx[0]
    }
    if (dirty & (1 << 2)) {
      console.log('update t4')
      t4.textContent = ctx[2]
    }
  }
  
  return {
    create,
    mount,
    update,
  }
}

let promise = Promise.resolve();
// 定义本次dom更新是否已经开始
let update_scheduled = false;

function update($$) {
  if (!update_scheduled) {
    update_scheduled = true;
    $$.update();
    // 执行其他的字段更新，也就是之前isMoreThan3的计算
    promise = Promise.resolve().then(() => {
      $$.fragment?.update($$.dirty);
      update_scheduled = false
      $$.dirty = 0;
    })
  }
}



class Demo1 {
  constructor(props) {
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
    c.mount(props.target, props.anchor);
    $$.dirty = 0;
  }
}

new Demo1({target: document.body});

