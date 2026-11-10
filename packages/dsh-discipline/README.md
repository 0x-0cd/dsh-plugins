# dsh-discipline

给 DeepSeek Harness 加一段**静态**的系统提示词纪律块。

## 为什么是"静态"

系统提示词是每个请求的缓存前缀。任何逐轮变化的内容（时间戳、计数器、会话状态）都会让前缀缓存整段失效——省下的思考成本会从缓存命中率上还回去。所以这个插件只注册一个常量字符串，并关闭 `interpolate`，让文本里的 `{{...}}` 永远按字面量处理。

## 装法

不安装依赖，直接在 profile 的 `cordis.patch.yml` 里按绝对路径挂：

```yaml
- insert:
    - id: optimize-discipline
      name: '/absolute/path/to/dsh-plugins/packages/dsh-discipline/index.js'
```

改完重启 `dsh web`（插件声明只在启动时扫描）。

## 配置

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 关闭后不注册任何东西 |
| `sectionName` | string | `optimize:discipline` | 同 scope 内唯一；同名会覆盖而不是重复 |
| `order` | number | `120` | 排在 persona 前缀（0）之后、plan policy（500）之前 |
| `language` | `zh` \| `en` | `zh` | 选用内置文案 |
| `text` | string | `''` | 非空时完全覆盖内置文案 |
| `debug` | boolean | `false` | 打一行 `[dsh-optimize]` 到 stderr，证明这段真的进了组装结果 |

## 内置文案覆盖的六条

1. 输出面向决策，不面向 diff（给影响面、理由、被放弃的方案）
2. 交付物即合法停止点（不要为"证明没犯错"继续验证不可知的事）
3. 不要中途停下来等确认
4. 否定式边界是硬约束
5. 结论要能指到证据（`文件:行号` / 命令输出 / 测试结果）
6. 多文件或架构性改动先给方案

## 已知边界

- 如果某个 persona 用 `complete: true` 注册，注册表会用那一段替换整个系统提示词，本段随之消失。这是上游行为，不是本插件的问题；打开 `debug` 会看到 `present=false`。
- 只影响系统提示词，不改工具、权限或模型路由。
