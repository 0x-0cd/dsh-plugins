# AGENTS.md — dsh-plugins

本仓是自研 DSH 插件的唯一来源。仓库级规则，覆盖个人默认习惯；用户显式指令优先。

## 结构约束

- 一个插件一个目录：`packages/<name>/`，且 `package.json` 是可安装单元。不建 workspace、不引构建链。
- 每个包保持**零运行时依赖、零构建、纯 ESM**。需要官方能力时走 `peerDependencies`，pin 到当前 dsh 运行时版本（`0.2.x-rc.N`）。
- `package.json` 的 `repository` 必须带 `directory: packages/<name>`，否则插件的来源追溯断掉。
- 声明了 `dsh.bundle` / `dsh.client` 的插件，其 `cordis.patch.yml` 与 `package.json` 的 `exports` 必须对得上；两者只能挂一处，重复挂载会起两个实例。
- 新插件必带 `test/` 和至少一条能红的用例。测试零依赖，`node --test` 直接跑，不引 test runner。

## 改代码前后

- 动手前跑一遍：`node --test packages/*/test/*.test.mjs`，确认基线是绿的。
- 改完必须重跑单测；`dsh-web-restart` 的改动另跑 `node --test packages/dsh-web-restart/_smoke/*.mjs`（它用桩 DOM 和桩 signal，不跑就等于没测）。
- 语法门禁：`for f in packages/*/*.js; do node --check "$f"; done`。

## 生效方式（容易踩）

- 插件声明**只在启动时扫描**。改完要让 `dsh web` 重启才生效——不要承诺热更新。
- `file:` 安装是拷贝进 profile 的 `node_modules`，改了本仓源码不会自动生效，要重跑 `dsh plugin add file:$PWD/packages/<name>`（或 profile 里 `pnpm install`）。
- 按绝对路径挂载的行（profile 的 `cordis.patch.yml` 里 `name:` 指向 `index.js`）读的是源码本身，改完只需重启。

## 密钥

- 任何密钥、token、cookie、私钥**都不许进仓库**，注释、测试夹具、文档示例一律用假值。
- 提交前跑 `.githooks/pre-commit` 的两层检查（gitleaks + 形态 grep）；命中即阻断，确认误报才 `--no-verify`。
- 插件运行时从环境变量或 dsh 凭据服务取 key，不读写凭据文件。

## 提交

- Conventional Commits：`type(scope): summary`，`scope` 用包名去掉 `dsh-` 前缀（如 `feat(opencode-go-status): ...`）。
- 一个提交一个意图；跨包改动在 body 里说明影响面。
- 版本语义：修复 `patch`，向后兼容 `minor`，破坏性 `major`；改 peer 上界算 `major`。
