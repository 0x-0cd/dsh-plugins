# dsh-plugins

自研的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）插件，集中在一个 monorepo 里。每个插件零依赖、零构建、纯 ESM，`packages/<name>/` 即安装单元。

| 插件 | 形态 | 版本 | 作用 |
|---|---|---|---|
| [`dsh-discipline`](packages/dsh-discipline/) | 系统提示词段（`systemPrompt.section()`） | 0.1.0 | 注入固定工作纪律段：面向决策、交付物即停止点、不中途停、否定式边界、证据指向、多文件先给方案 |
| [`dsh-opencode-go-status`](packages/dsh-opencode-go-status/) | Web 插件（宿主路由 + 客户端面板） | 0.1.1 | OpenCode Go 订阅面板：套餐用量、剩余额度、到期与续费状态 |
| [`dsh-web-search-failover`](packages/dsh-web-search-failover/) | `web_search` provider | 0.1.1 | Exa 主 + 官方 DeepSeek 搜索自动回退，单条搜索腿挂掉不再直接失败 |
| [`dsh-web-restart`](packages/dsh-web-restart/) | Web 插件（侧边栏按钮 + 路由） | 0.2.0 | 一键重启 `dsh web` 守护进程，以及「关闭 DSH」终止而不重启 |

`dsh-web-restart` 是 [1123762794/dsh-web-restart](https://github.com/1123762794/dsh-web-restart) 的 fork，本仓在其之上重写了宿主/客户端两半并加了关闭路由；上游 LICENSE 见包内。

## 结构

```
packages/<name>/            单个插件：package.json 是安装单元
packages/<name>/test/       node:test 单测（零依赖，直接 node --test）
packages/dsh-web-restart/_smoke/   需要桩 DOM / 桩 signal 的回归测试
```

## 安装

**先看形态**：声明了 `dsh.bundle` 的插件（`dsh-opencode-go-status`、`dsh-web-restart`）装进 profile 就会自动插入挂载行；其余两个装成普通依赖，再由 `cordis.patch.yml` 显式挂载。

```sh
# 从本仓根目录执行，$PWD 由 shell 展开
dsh plugin --profile web add file:$PWD/packages/dsh-opencode-go-status
dsh plugin --profile web add file:$PWD/packages/dsh-web-restart
dsh plugin --profile web add file:$PWD/packages/dsh-web-search-failover
dsh plugin --profile web add file:$PWD/packages/dsh-discipline
```

`file:` 安装是**拷贝**：pnpm 把包快照进 profile 的 `node_modules`，所以拉取新提交后要重跑同一条命令。想改源码即时生效，用 `link:`，或按绝对路径在 `cordis.patch.yml` 里挂 `index.js`。

**插件声明只在启动时扫描**，装完/改完都要重启 `dsh web`。

## 开发

```sh
node --test packages/*/test/*.test.mjs            # 单测
node --test packages/dsh-web-restart/_smoke/*.mjs # 回归测试（桩 DOM）
for f in packages/*/*.js; do node --check "$f"; done
```

## 密钥

仓库里不放任何凭据。`.githooks/pre-commit` 在暂存区做两层检查（gitleaks + 形态 grep），启用一次：

```sh
git config core.hooksPath .githooks
```

插件运行期一律从环境变量或 dsh 的凭据服务取 key（`OPENCODE_GO_API_KEY`、`EXA_API_KEY`、`DEEPSEEK_API_KEY`），不落盘。
