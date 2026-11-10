/**
 * dsh-discipline — a static system-prompt section for DeepSeek Harness.
 *
 * Why a static section and not a dynamic one: the system prompt is the cached
 * prefix of every request. A section whose text changes between turns (a
 * timestamp, a counter, a per-session state dump) invalidates the prefix cache
 * on every step. This section is therefore a constant string, and `interpolate`
 * is disabled so literal `{{...}}` in the text is never treated as a variable.
 *
 * Placement: default order 120 sits after the deployment persona prefix (0)
 * and before the first-party plan policy (500), so the rules frame everything
 * that follows. A persona registered with `complete: true` replaces the whole
 * system prompt and this section is dropped by the registry — that is upstream
 * behavior, not a bug here.
 *
 * @module dsh-discipline
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'discipline'

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/** Default section name. Unique per scope; scoped contributions shadow global ones. */
export const DEFAULT_SECTION_NAME = 'optimize:discipline'

/** Defaults, mirroring the config shape documented in README.md. */
export const DEFAULTS = Object.freeze({
  enabled: true,
  sectionName: DEFAULT_SECTION_NAME,
  order: 120,
  language: 'zh',
  text: '',
  debug: false,
})

/** Chinese rules. Keep this text stable across turns — see the module note. */
export const ZH_TEXT = `## 工作纪律

以下规则优先于默认习惯；项目 AGENTS.md 与用户的显式指令优先级更高。

1. **输出面向决策，不面向 diff。** 先说改动的影响面、这样决策的理由、被放弃的替代方案。不要逐行复述代码；定位用 \`文件:行号\`。
2. **交付物即合法停止点。** 产出用户要的文件、改动或结论后即可结束。不要为了"证明自己没犯错"继续验证只有执行之后才能知道结果的事情（热重载是否生效、网关是否接受某个值、默认值解析路径是否正确）。这些留给用户或下一轮。
3. **不要中途停下来等确认。** 除非用户要求逐段确认，否则一次做完；确实需要用户决策的，放到最后一次性列出。
4. **否定式边界是硬约束。** 用户说"不要做什么"时，它的优先级高于任何关于"应该做得更完整"的隐含期待。
5. **结论要能指到证据。** 每个判断指向具体 \`文件:行号\`、命令输出或测试结果；没有证据的推断必须标为推断。
6. **多文件或架构性改动先给方案。** 用三五行说明打算怎么做，再动手。`

/** English rules, semantically equivalent to {@link ZH_TEXT}. */
export const EN_TEXT = `## Working discipline

These rules override default habits; project AGENTS.md and explicit user instructions take precedence.

1. **Report for decisions, not for diffs.** Lead with blast radius, the reason for each decision, and the alternatives you rejected. Do not narrate code line by line; locate with \`file:line\`.
2. **A deliverable is a valid stopping point.** Once the requested file, change, or conclusion exists, stop. Do not keep verifying what can only be known after the change ships (does hot reload pick it up, does the gateway accept the value, is the default-resolution path right). Leave those to the user or the next turn.
3. **Do not stop mid-task for confirmation.** Finish in one pass unless the user asked for staged approval; collect genuine decisions into a single list at the end.
4. **Negative constraints are hard.** When the user says "don't do X", that outranks any implicit expectation to be more thorough.
5. **Claims must point at evidence.** Cite \`file:line\`, command output, or test results; label anything unverified as inference.
6. **Propose before multi-file or architectural work.** Three to five lines on the approach, then execute.`

/**
 * Normalize untrusted loader config into a complete, validated config.
 *
 * Accepts `undefined`, `null`, or a partial object. Unknown keys are dropped so
 * a stale profile config cannot inject surprises after an upgrade.
 *
 * @param {unknown} raw - config as delivered by the Cordis loader (YAML-decoded).
 * @returns {{enabled: boolean, sectionName: string, order: number, language: string, text: string, debug: boolean, resolvedText: string}}
 * @throws {TypeError} when a known key has the wrong type.
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const enabled = pickBoolean(input.enabled, DEFAULTS.enabled, 'enabled')
  const debug = pickBoolean(input.debug, DEFAULTS.debug, 'debug')
  const sectionName = pickString(input.sectionName, DEFAULTS.sectionName, 'sectionName')
  const language = pickString(input.language, DEFAULTS.language, 'language')
  const text = pickString(input.text, DEFAULTS.text, 'text')
  const order = pickNumber(input.order, DEFAULTS.order, 'order')
  if (sectionName.trim() === '') throw new TypeError('dsh-discipline: sectionName must not be empty')
  const resolvedText = text !== '' ? text : language === 'en' ? EN_TEXT : ZH_TEXT
  return { enabled, sectionName, order, language, text, debug, resolvedText }
}

/**
 * Register the discipline section (and, when `debug` is set, an assembly probe).
 * @param {import('@deepseek-ai/cordis').Context} ctx - mounting context.
 * @param {unknown} raw - loader config.
 * @returns {void}
 */
export function apply(ctx, raw) {
  const config = normalizeConfig(raw)
  if (!config.enabled) return

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: config.sectionName,
        order: config.order,
        text: config.resolvedText,
        // Keep literal braces literal: this block is prose, never a template.
        interpolate: false,
      }),
    'discipline.section()',
  )

  if (!config.debug) return

  let lastReport = ''
  ctx.effect(
    () =>
      ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const assembled = await next()
        const present = assembled.sections.some((section) => section.name === config.sectionName)
        const chars = assembled.sections.reduce((total, section) => total + section.text.length, 0)
        const report = `discipline present=${present} sections=${assembled.sections.length} chars=${chars}`
        if (report !== lastReport) {
          lastReport = report
          report_(`[dsh-optimize] ${report}`)
        }
        return assembled
      }),
    'discipline.debug()',
  )
}

/** Emit one diagnostic line on stderr. Stable prefix so it is greppable in logs. */
function report_(line) {
  // eslint-disable-next-line no-console
  console.error(line)
}

function pickBoolean(value, fallback, key) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') throw new TypeError(`dsh-discipline: ${key} must be a boolean`)
  return value
}

function pickString(value, fallback, key) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string') throw new TypeError(`dsh-discipline: ${key} must be a string`)
  return value
}

function pickNumber(value, fallback, key) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`dsh-discipline: ${key} must be a finite number`)
  }
  return value
}
