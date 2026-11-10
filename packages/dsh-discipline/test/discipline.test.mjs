import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_SECTION_NAME,
  DEFAULTS,
  EN_TEXT,
  ZH_TEXT,
  apply,
  normalizeConfig,
} from '../index.js'

/** Minimal Cordis-like context capturing what the plugin registers. */
function makeCtx() {
  const sections = []
  const listeners = []
  const effects = []
  return {
    sections,
    listeners,
    effects,
    ctx: {
      effect(factory) {
        const disposer = factory()
        effects.push(disposer)
        return disposer
      },
      systemPrompt: {
        section(section) {
          sections.push(section)
          return () => {}
        },
      },
      on(event, listener, options) {
        listeners.push({ event, listener, options })
        return () => {}
      },
    },
  }
}

test('defaults are stable and match the documented shape', () => {
  assert.deepEqual(normalizeConfig(undefined), {
    ...DEFAULTS,
    resolvedText: ZH_TEXT,
  })
  assert.equal(DEFAULT_SECTION_NAME, 'optimize:discipline')
})

test('language selects the built-in text, explicit text wins', () => {
  assert.equal(normalizeConfig({ language: 'en' }).resolvedText, EN_TEXT)
  assert.equal(normalizeConfig({ language: 'zh' }).resolvedText, ZH_TEXT)
  assert.equal(normalizeConfig({ text: 'CUSTOM' }).resolvedText, 'CUSTOM')
  assert.equal(normalizeConfig({ text: 'CUSTOM', language: 'en' }).resolvedText, 'CUSTOM')
})

test('unknown keys are dropped rather than forwarded', () => {
  const config = normalizeConfig({ nope: 1, _legacy: true })
  assert.equal('nope' in config, false)
  assert.equal('_legacy' in config, false)
})

test('wrong types fail loud', () => {
  assert.throws(() => normalizeConfig({ order: '120' }), /order must be a finite number/)
  assert.throws(() => normalizeConfig({ enabled: 'yes' }), /enabled must be a boolean/)
  assert.throws(() => normalizeConfig({ sectionName: '   ' }), /sectionName must not be empty/)
})

test('apply registers one static, non-interpolated section', () => {
  const { ctx, sections } = makeCtx()
  apply(ctx, {})
  assert.equal(sections.length, 1)
  assert.deepEqual(sections[0], {
    name: DEFAULT_SECTION_NAME,
    order: 120,
    text: ZH_TEXT,
    interpolate: false,
  })
})

test('disabled registers nothing', () => {
  const { ctx, sections, listeners } = makeCtx()
  apply(ctx, { enabled: false })
  assert.equal(sections.length, 0)
  assert.equal(listeners.length, 0)
})

test('debug installs an assembly probe that reports presence once per shape', async () => {
  const { ctx, listeners } = makeCtx()
  const lines = []
  const originalError = console.error
  console.error = (line) => lines.push(line)
  try {
    apply(ctx, { debug: true })
    const probe = listeners.find((entry) => entry.event === 'system-prompt/assemble')
    assert.ok(probe, 'expected a system-prompt/assemble listener')

    const withSection = {
      sections: [{ name: DEFAULT_SECTION_NAME, text: 'abcdef' }, { name: 'other', text: 'xyz' }],
    }
    await probe.listener({}, {}, async () => withSection)
    await probe.listener({}, {}, async () => withSection)
    assert.equal(lines.length, 1, 'identical assemblies should be reported once')
    assert.match(lines[0], /discipline present=true sections=2 chars=9/)

    await probe.listener({}, {}, async () => ({ sections: [{ name: 'other', text: 'x' }] }))
    assert.equal(lines.length, 2)
    assert.match(lines[1], /discipline present=false/)
  } finally {
    console.error = originalError
  }
})
