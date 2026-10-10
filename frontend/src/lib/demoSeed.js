// The example profile behind the demo build (see demo.js). Imported dynamically, so it stays
// out of the bundle self-hosters ship.
import { isoOf, uid } from './format.js'
import { starterRoutines } from './starter.js'
import { modeOf } from './history.js'
import { emptyMeasurement } from './measurements.js'

// Starting weight and weekly increment per exercise of the studio plan (kg).
// Bridges, pull-aparts, dead bugs, bird dogs and clams are body-weight only here, so they
// log reps at 0 added weight.
const PROG = {
  '1760': [12, 0.5], '1459': [16, 0.5], '0861': [25, 1.25], '1422': [0, 0], '1503': [0, 0], '0276': [0, 0],
  '3691': [10, 0.5], '2291': [25, 1], '0314': [8, 0.5], '0405': [6, 0.25], '2487': [4, 0.25], '0597': [20, 1], '1241': [0, 0],
  '0431': [8, 0.5], '4742': [20, 1], '2393': [10, 0.5], '5656': [8, 0.25], '4870': [0, 0], '4193': [8, 0.25], '0417': [12, 0.5]
}
const WEEKS = 12                       // how much history to fabricate
const BW_FROM = 67.8, BW_TO = 65.4     // body-weight trend across those weeks
const TARGET_W = 64.5

// --- Effort -----------------------------------------------------------------------------
// The demo has to show the effort stats, not just the volume ones, so the history carries
// ratings. Flat ratings would draw a flat trend and prove nothing, so this fabricates the
// shape the charts exist to make visible: a block grinding toward failure, a deload jumping
// back off it, another block going a little deeper than the first.
const DELOAD_WEEK = 5
// Reps left in the tank the block is aiming for, by week.
const weekTarget = wk =>
  wk === DELOAD_WEEK ? 4.5
    : wk < DELOAD_WEEK ? 2.8 - wk * 0.3
      : 2.6 - (wk - DELOAD_WEEK - 1) * 0.26
// Posture and core accessories are trained further from failure than the main lifts —
// deliberate, so the muscle map's "hard sets" mode shows a different picture from its all-sets mode.
const EASY = new Set(['1503', '0276', '1241', '4870', '2487', '5656'])
// One exercise nobody ever rates: partial coverage is the normal case (rating is optional and
// off by default), and it shows the per-exercise Effort toggle correctly staying away.
const NEVER_RATED = '0417'
const UNRATED = 0.1                    // …plus this share of the remaining sets, at random
// The first weeks are logged in RPE, as if they came out of another app before the profile
// switched to RIR. A set is never rewritten (see history.js), so the stats have to average a
// mixed history as one series — the demo should be showing that, not hiding it.
const RPE_UNTIL = 3
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Deterministic PRNG — the demo should look the same on every visit and in screenshots.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const round = (w, step) => Math.round(w / step) * step
const at = (date, h, m) => { const d = new Date(date); d.setHours(h, m, 0, 0); return d.getTime() }
// The Monday of a date. The effort trend is plotted per calendar week, so the training block
// has to run on calendar weeks too — a deload counted off the first day of the history would
// straddle two points and average itself away in both.
const monday = date => { const d = new Date(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(12, 0, 0, 0); return +d }

// A full example profile: 12 weeks of Mon/Wed/Fri sessions on the studio plan, with linear
// progression, the odd missed session, twice-weekly weigh-ins trending toward the goal, and
// per-set effort ratings on most (not all) of it.
export function buildDemoState() {
  const rnd = rng(20260723)
  // Measurements draw from their own stream. They are logged on a different cadence than the
  // training they sit next to, so taking them from `rnd` would slide every later draw along —
  // the weigh-in jitter, the missed-session roll, the rep drop-offs, the session start times —
  // and silently rewrite the demo history that mcp/test/tools.test.js pins exact values against.
  // Anything added here later wants its own generator too, not a share of this one.
  const mrnd = rng(20260724)
  const [foundation, align, steady] = starterRoutines()
  const byWeekday = { 1: foundation, 3: align, 5: steady }

  const nowH = new Date().getHours()
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const start = new Date(today); start.setDate(start.getDate() - WEEKS * 7)

  const workouts = []
  const bodyweight = []
  const measurements = []
  const exWeights = {}
  const best = {}

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const day = new Date(d)
    const iso = isoOf(day)
    const weekIdx = Math.floor((day - start) / (7 * 86400000))
    const p = Math.min(1, weekIdx / WEEKS)

    // weigh-ins: Monday and Thursday mornings
    if (day.getDay() === 1 || day.getDay() === 4) {
      const w = BW_FROM + (BW_TO - BW_FROM) * p + (rnd() - 0.5) * 0.7
      bodyweight.push({ d: iso, w: Math.round(w * 10) / 10, t: at(day, 7, 30) })
    }

    // A fortnightly tape check gives every measurement chart enough points to be useful in
    // the public demo. The asymmetry is intentional and small — real bodies are not mirrored.
    if (day.getDay() === 0 && weekIdx % 2 === 0) {
      const e = emptyMeasurement(iso)
      e.t = at(day, 8, 10)
      e.neck = Math.round((33.4 - p * 0.4 + (mrnd() - 0.5) * 0.2) * 10) / 10
      e.shoulders = Math.round((106 + p * 0.8 + (mrnd() - 0.5) * 0.4) * 10) / 10
      e.chest = Math.round((96 - p * 1.2 + (mrnd() - 0.5) * 0.3) * 10) / 10
      e.waist = Math.round((82 - p * 6.4 + (mrnd() - 0.5) * 0.5) * 10) / 10
      e.hips = Math.round((102 - p * 2.2 + (mrnd() - 0.5) * 0.3) * 10) / 10
      e.upperArmLeft = Math.round((28.2 + p * 0.4 + (mrnd() - 0.5) * 0.2) * 10) / 10
      e.upperArmRight = Math.round((28.5 + p * 0.4 + (mrnd() - 0.5) * 0.2) * 10) / 10
      e.forearmLeft = Math.round((23.1 + p * 0.2) * 10) / 10
      e.forearmRight = Math.round((23.4 + p * 0.2) * 10) / 10
      e.thighLeft = Math.round((56 + p * 0.6) * 10) / 10
      e.thighRight = Math.round((56.4 + p * 0.6) * 10) / 10
      e.calfLeft = Math.round((35.4 + p * 0.2) * 10) / 10
      e.calfRight = Math.round((35.7 + p * 0.2) * 10) / 10
      e.bodyFat = Math.round((30.5 - p * 3.2 + (mrnd() - 0.5) * 0.3) * 10) / 10
      measurements.push(e)
    }

    const routine = byWeekday[day.getDay()]
    if (!routine) continue
    if (rnd() < 0.09) continue                      // life happens — a few missed sessions
    if (iso === isoOf(today) && nowH < 18) continue   // leave today's session to try out, unless it's already evening

    const prs = []
    const blockWk = Math.round((monday(day) - monday(start)) / (7 * 86400000))
    const rir0 = weekTarget(blockWk)
    const scale = blockWk < RPE_UNTIL ? 'rpe' : 'rir'
    const entries = routine.ex.map((cfg, exIdx) => {
      const [base, inc] = PROG[cfg.id] || [20, 0.5]
      const step = base >= 40 ? 2.5 : 1.25
      // The deload pulls the weight back too — effort dropping on its own would look like the
      // same session suddenly got easy.
      const back = blockWk === DELOAD_WEEK ? 0.88 : 1
      const w = base ? Math.max(step, round((base + inc * weekIdx) * back, step)) : 0
      const rateable = modeOf(cfg) === 'reps' && cfg.id !== NEVER_RATED
      const sets = []
      for (let i = 0; i < cfg.sets; i++) {
        // last set is where reps usually start slipping
        const drop = i === cfg.sets - 1 && rnd() < 0.55 ? (rnd() < 0.4 ? 2 : 1) : 0
        const s = { w, r: Math.max(4, cfg.reps - drop), done: true }
        const rir = clamp(round(rir0
          + (cfg.sets - 1 - i) * 0.6      // a first set sits further from failure than a last
          - exIdx * 0.12                  // …and fatigue accumulates across the session
          + (EASY.has(cfg.id) ? 1.2 : 0)
          - (drop ? 0.5 : 0)              // reps slipping is the set that ran out of room
          + (rnd() - 0.5), 0.5), 0, 6)
        if (rateable && rnd() > UNRATED) {
          // RPE's floor of 6 is a convention about which sets are worth rating, so an easy
          // set logged in RPE genuinely loses the distance it was from failure.
          if (scale === 'rpe') s.rpe = clamp(10 - rir, 6, 10)
          else s.rir = rir
        }
        sets.push(s)
      }
      if (w > (best[cfg.id] || 0)) { best[cfg.id] = w; prs.push(cfg.id) }
      exWeights[cfg.id] = { w: Math.max(w, exWeights[cfg.id]?.w || 0), d: iso }
      return { id: cfg.id, sets, topW: w || null }
    })

    const bw = bodyweight.length ? bodyweight[bodyweight.length - 1].w : BW_FROM
    const startMs = at(day, 18, 5 + Math.floor(rnd() * 25))
    const w = {
      id: uid(), d: iso, start: startMs, end: startMs + (46 + Math.floor(rnd() * 26)) * 60000,
      routineId: routine.id, name: routine.name, bw,
      entries,
      prs: weekIdx === 0 ? [] : prs   // the very first session isn't a PR party
    }
    w.vol = entries.reduce((v, e) => v + e.sets.reduce((n, s) => n + s.w * s.r, 0), 0)
    workouts.push(w)
  }

  // A visitor should always have something to press "Start" on, so if they land on a rest day
  // the next routine in the rotation is moved onto today — which also shows off rescheduling.
  const dayPlan = {}
  const tIso = isoOf(today)
  if (!byWeekday[today.getDay()] && !workouts.some(w => w.d === tIso)) {
    const order = [foundation, align, steady]
    const lastName = workouts.length ? workouts[workouts.length - 1].name : steady.name
    dayPlan[tIso] = order[(order.findIndex(r => r.name === lastName) + 1) % order.length].id
  }

  return {
    routines: [foundation, align, steady],
    week: { 1: foundation.id, 3: align.id, 5: steady.id },
    // The example client, and the studio's own colours. A fresh self-hosted profile still
    // starts from the store defaults; only the seeded demo carries these.
    body: 'female',
    accent: 'harbor',
    dayPlan,
    workouts, bodyweight, measurements, exWeights,
    targetW: TARGET_W,
    // The history is rated, so the demo turns the column on and the stats get a scale to
    // label their aggregates with instead of guessing one (see displayScale).
    effort: 'rir'
  }
}
