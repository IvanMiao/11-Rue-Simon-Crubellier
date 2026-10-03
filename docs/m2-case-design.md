# M2 — CaseGraph vertical slice: 「第 439 幅」

Goal: the run is won by **deduction on a fill-in case board**, not by a die roll. One hand-written case,
10 case rooms + room 100, roughly 20 minutes of real play inside the 240-minute night.

## 1. Rules

| Action | Cost | Effect |
|---|---|---|
| Move | walk 15 / knight 8 / elevator 20 min (unchanged) | Entering a case room caches its local content immediately (no LLM). |
| Look (`kind: 'look'` evidence) | 5 min | Always succeeds; grants its cards; consumed. |
| Check (`kind: 'check'` evidence) | 5 min + existing check rules (XP, morale) | Success: grants `cards`; consumed. Failure: grants `failCards` (vague/misleading). White: retry allowed only after the player owns more cards than at the last failed attempt. Red: one attempt. |
| Combine two owned cards (联想) | 10 min | If an unused recipe matches the unordered pair → grants its cards + text, recipe used. Otherwise "nothing" (time still spent). |
| Place / clear a card in a slot | free | Card must be owned and of an accepted kind; slots in a locked group are frozen; a card can sit in only one slot. |
| Submit a group (对照) | 5 min | All 3 slots filled required. All correct → group locked. Otherwise morale −1; no hint which slot is wrong. |
| Close the case in room 100 (`FINALE_INTERACTION`, now an action, no dice) | 0 | Allowed when ≥2 groups locked → `runStatus: 'solved'`, `caseGrade = lockedGroups.length` (2 = 残缺的结案, 3 = 完整结案). |

- Room `100-1` is reachable when **≥2 groups are locked** (replaces puzzle-piece / clue-count unlock).
- Midnight / collapse end the run as before; the end screen shows how many groups were locked.
- Non-case rooms keep Gemini/fallback content. Their checks still give XP and cost morale, but their clues no longer affect winning.
- The story bible for a run is built locally from the case (`caseBible(graph)`); Gemini still writes prose for non-case rooms using that bible.
- The old finale retry (`finaleFactsAtAttempt`) and dice finale are removed.

## 2. Seeded variation

`buildCase(seed)` picks **the liar** among 诺谢尔太太 / 斯莫特 / 瓦莱纳 (`mulberry32(seed)`), which changes
answers B1–B3, the proof-object texts and which testimony+proof recipe works. The skill used by the
hand check E3 is seeded between `perception` and `logic`. Everything else is fixed hand-written content.

| Liar | Claimed (testimony) | True place (B2) | Proof object (B3) | Proof room |
|---|---|---|---|---|
| `p-nochere` 诺谢尔太太 | 门房 `pl-loge` | 锅炉房 `pl-cellar` | 沾煤灰的手套 `o-coal-glove` | -1-3 |
| `p-smautf` 斯莫特 | 仆人房 `pl-attic` | 古董店 `pl-antiques` | 古董店收据 `o-receipt` | 0-3 |
| `p-valene` 瓦莱纳 | 画室 `pl-studio` | 巴特尔布思的工作室 `pl-bartlebooth` | 未干的画笔 `o-wet-brush` | 3-1 |

## 3. Board

Question: 「二十点整，巴特尔布思死在第 439 幅拼图前。把案卷补完。」

| Group | Slot | Prompt (UI copy) | Accepts | Answer |
|---|---|---|---|---|
| A 缺块 | A1 | 桌上空洞的形状像字母 ___ | shape | `shape-x` |
| | A2 | 他手里那一块的形状像字母 ___ | shape | `shape-w` |
| | A3 | 切出这一块的人是 ___ | person | `p-winckler` |
| B 证词 | B1 | 说了谎的人是 ___ | person | liar |
| | B2 | 二十点整，那个人其实在 ___ | place | true place |
| | B3 | 证明这一点的物件是 ___ | object | proof object |
| C 动机 | C1 | 切割的人死于 ___ | time | `t-1973` |
| | C2 | 他留下这一块，是为了 ___ | word | `w-revenge` |
| | C3 | 这件事最早写在 ___ | object | `o-ledger-439` |

## 4. Cards (id · kind · label)

- person: `p-bartlebooth` 巴特尔布思 · `p-winckler` 温克勒 · `p-morellet` 莫雷莱 · `p-nochere` 诺谢尔太太 · `p-smautf` 斯莫特 · `p-valene` 瓦莱纳
- shape: `shape-x` X 形 · `shape-w` W 形 · `shape-v` V 形 (decoy)
- place: `pl-loge` 门房 · `pl-attic` 仆人房 · `pl-studio` 画室 · `pl-cellar` 锅炉房 · `pl-antiques` 古董店 · `pl-bartlebooth` 巴特尔布思的工作室
- object: `o-death-notice` 讣告 · `o-cut-notes` 切割笔记 · `o-ledger-439` 账簿第 439 行 · `o-blank-sheet` 洗白的水彩纸 · `o-coal-glove` 沾煤灰的手套 · `o-receipt` 古董店收据 · `o-wet-brush` 未干的画笔
- testimony (combine-only, accepted by no slot): `ts-nochere` 诺谢尔太太的证词 · `ts-smautf` 斯莫特的证词 · `ts-valene` 瓦莱纳的证词
- time: `t-1973` 1973 年 · `t-1975` 1975 年 6 月 (decoy) · `t-1950` 1950 年 (decoy)
- word: `w-revenge` 报复二十年的徒劳 · `w-gift` 一份礼物 (decoy) · `w-mistake` 一次失手 (decoy)

## 5. Evidence by room

Texts are the response shown in the journal; `{liar?}` marks seed-dependent text.

| Room | Id | Kind | Label | Cards (fail cards) | Response |
|---|---|---|---|---|---|
| 0-5 HALL | `ev-hall-mailboxes` | look | 读信箱上的名字 | all 6 persons | 铜牌一排排亮着。巴特尔布思、温克勒、莫雷莱、诺谢尔太太、斯莫特、瓦莱纳。温克勒的那格信箱塞满了两年的灰。 |
| 3-1 BARTLEBOOTH | `ev-bb-puzzle` | look | 俯看桌上的拼图 | `shape-x` | 第 439 幅港口只剩一个空洞。空洞的轮廓像一个 X。 |
| | `ev-bb-hand` | check, seeded perception/logic, challenging, white | 掰开他攥紧的手指 | `shape-w` (`shape-v`) | 成功：那一块的轮廓是 W。它永远放不进 X。 失败：指缝里露出一角，像一个 V。你不太确定。 |
| | `ev-bb-sill` | look | 看窗台上的画笔 | `o-wet-brush` | {valene} 笔尖还是湿的，钴蓝和今晚的天空同一个颜色。{else} 笔毛硬得像草，至少干了一周。 |
| 6-3 WINCKLER | `ev-wk-bench` | look | 翻开工作台上的笔记 | `o-cut-notes` | 五百幅拼图的切割记录，一行一幅，字迹越来越小。 |
| | `ev-wk-chair` | check, inland, challenging, red | 对着空椅子问他为什么 | `w-revenge` (`w-mistake`) | 成功：椅子说：二十年，他只要求一个错位。 失败：你只听见自己说：也许只是手抖了。 |
| 0-4 LOGE | `ev-loge-notice` | look | 读讣告栏 | `o-death-notice`, `t-1973` | 加斯帕尔·温克勒，拼图工匠，卒于 1973 年。卡片边缘已经发黄。 |
| | `ev-loge-ask` | look | 问诺谢尔太太二十点在哪 | `ts-nochere`, `pl-loge` | “我一直在门房，听见楼上有人起身。”她的手藏在围裙下面。 |
| 8-2 SMAUTF | `ev-sm-ask` | look | 问斯莫特二十点在哪 | `ts-smautf`, `pl-attic`, `w-gift` | “我在房里擦银器。主人说过，那块拼图是一份礼物。” |
| 7-7 VALÈNE | `ev-va-ask` | look | 问瓦莱纳二十点在哪 | `ts-valene`, `pl-studio` | “我在画室，没有离开过画布。”画布上整栋楼停在二十点，有一扇窗空着。 |
| | `ev-va-canvas` | check, encyclopedia, medium, white | 辨认画布角落的日期 | `t-1950` (`t-1975`) | 成功：角落写着 1950，巴特尔布思出发去画港口的那一年。 失败：你把它读成了今天的日期。 |
| 8-6 MORELLET | `ev-mo-vat` | look | 看药水槽里的纸 | `o-blank-sheet` | 每一幅拼好的港口都在这里被拆胶、洗回白纸，再寄回它被画下的海边。 |
| -1-3 CHAUFFERIE | `ev-ch-coal` | look | 翻煤堆旁的手套 | `o-coal-glove` | {nochere} 手套还是温的，内侧缝着门房的号码。{else} 手套冷透了，挂在这里不止一个冬天。 |
| 0-3 ANTIQUITÉS | `ev-an-receipt` | look | 读柜台上的收据 | `o-receipt` | {smautf} 收据开于 20:00 整，签名：斯莫特。{else} 收据是上周的，签名是马基索夫人。 |
| 6-1 CINOC | `ev-ci-dict` | check, encyclopedia, medium, white | 翻他正在删去的词条 | `t-1973` (`t-1975`) | 成功：被删去的词条旁注着“温克勒，1973”。 失败：你只看清了今天的日期。 |

## 6. Recipes (unordered pairs)

| Id | Pair | Grants | Text |
|---|---|---|---|
| `rc-ledger` | `o-cut-notes` + `shape-x` | `o-ledger-439`, `shape-w` | 第 439 行写着：洞是 X，块是 W。日期是 1972 年，他死前一年。 |
| `rc-revenge` | `o-ledger-439` + `o-blank-sheet` | `w-revenge` | 二十年的港口最后都会变回白纸。温克勒只想让其中一幅永远合不上。 |
| `rc-alibi` | `ts-{liar}` + `{proof}` | `{true place}` | {nochere} 她说在门房，手套却还带着锅炉房的余温。{smautf} 他说在擦银器，收据却在 20:00 写下他的名字。{valene} 他说没离开画布，可他的笔在巴特尔布思的窗台上还没干。 |

Only the liar's `rc-alibi` exists for a given seed.

## 7. Map signal
Case rooms with untaken evidence show a lit-window marker on `BuildingMap`; exhausted case rooms dim.

## 8. Verification targets
- Solver: for every liar variant, all 9 answers are reachable **without any skill check** (looks + recipes only). Checks are shortcuts (the hand check gives `shape-w` without the 10-minute `rc-ledger` combine; the red chair check gives `w-revenge` without `rc-revenge`), never gates.
- Sim (2000 seeds/bot/archetype): `caseBot` (perfect deducer, nearest-evidence routing) — grade ≥2 ≥ 70%; `guessBot` (owns cards, fills slots at random, submits) — grade ≥2 ≤ 15%; trapped 0%; replay determinism. Report the table; thresholds are gates in `scripts/sim.ts`.
