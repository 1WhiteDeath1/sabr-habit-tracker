# Sabr

A habit app for Android, built as an installable web app (PWA). It gets a real
icon on your home screen, opens fullscreen with no browser bar, works fully
offline, and keeps every byte of your data on your own phone.

No account. No server. Nothing is uploaded anywhere.

---

## Install it on your phone

**Live at [1whitedeath1.github.io/sabr-habit-tracker](https://1whitedeath1.github.io/sabr-habit-tracker/)**

1. Open that link on your phone in **Chrome**.
2. Chrome menu (⋮) → **Add to Home screen** → **Install**.
   (An "Add Sabr to your home screen" bar also appears inside the app.)
3. Open it from the icon from now on, not from the browser.

It works fully offline after the first load, and your data never leaves the
phone — there is no account and no server to send it to.

### Running it locally

```bash
python dev-server.py 5173
```

Then open http://localhost:5173. The dev server sends `no-store`, and the app
skips service-worker registration on localhost, so you always get the file you
just edited. Append `?sw=1` to the URL when the offline behaviour is what you
are testing.

---

## What is in it

**Today** — your day laid out against the actual prayer times, each habit sitting
under the prayer it is anchored to. One tap to complete. A ring for the day, an
XP bar, and today's three optional side quests.

**Quests** — ten main quest chains that level up in tiers (The Foundation, Break
of Dawn, The Shield, Master of the Wave, The Deep Work, The Vessel, The Night
Watch, The Cartographer, The Architect, The Reciter), plus three side quests
rolled fresh each morning. Side quests carry **no penalty for ignoring them** —
that is deliberate, so the game never becomes a second job.

**Uni** — FAST-NUCES academics. See the section below.

**Focus** — a two-minute "Just start" button, longer blocks, a task list for the
thing you are avoiding, and an "Unstick me" flow that shrinks a stalled task down
to a physical first move.

**Reps** — indoor bodyweight training, built as five ladders (pull, push, legs,
core, heart) with six rungs each. Your **round** is one set of the rung you are
standing on for each pattern; the famous 5 pull-ups / 10 push-ups / 15 squats is
one of five preset rounds, and somebody who cannot do a pull-up starts two rungs
down on towel rows rather than staring at a target they will quietly stop
opening. Nothing on this screen has a streak: see the section below.

**Shield** — the pornography-recovery section. Clean counter, a full-screen SOS
urge-surfing timer with a breath pacer, HALT check and grounding prompts, trigger
pattern analysis showing which hours and which states actually do the damage, an
environment-defences checklist, and if–then plans. Turn it on or off freely.

**The ledger (Muhasabah)** — where you record what you left undone and what you
did wrong. Reachable from Today, from the night ritual, and from Me. It follows
the same rules as Shield: **logging earns XP and never deducts it**, every entry
asks for one concrete if–then correction, and the screen reports patterns rather
than a running tally of your failures. Running a correction pays another 20 XP,
because writing it down is only half of it.

**Me** — a year grid, the **horizons** display, per-habit health, the weekly
review, the full evidence index, and settings.

### Noor shows you around

After the six onboarding steps, a lamp called **Noor** walks through the app in
ten short cards — what Today is for, that a two-minute version counts, the
never-miss-twice rule, what the round button in the middle does, and one card
each for Quests, Shield, Uni and the night routine.

She is the only voice in the app that speaks in plain, short English. Everywhere
else the copy is deliberately blunt, which is right for someone who already
knows what a screen does and wrong for someone seeing it for the first time. One
idea per line, no idioms, nothing longer than a sentence.

Then she does it again on the real screen. The cards explain the ideas; the
second pass puts a gold ring around the actual control — the top bar, the day
ring, a real habit row, the More drawer, and each of the four tabs plus the
centre disc — with everything else dimmed and a bubble pointing at it.

That half is a DOM overlay rather than a route (`features/coach.js`), because the
point is that the real app is underneath. The dimming is one enormous
`box-shadow` spread from the ring itself, so the highlighted control needs no
z-index of its own to shine through. Targets are looked up at the moment each
step runs, never cached, and a step whose target is missing is **dropped rather
than faked** — a user with no habits yet is not shown a ring around empty space,
so the tour is 8 steps or 7 depending on what is actually on screen.

Both halves are skippable and repeatable from Settings: *Show me around again*
for the whole thing, *Just point at things* for the overlay alone. Skipping the
cards skips the overlay too — someone who wants out wants out of both. Quit
part-way through on a fresh install and it picks up where it left off; anyone who
already has habits is left alone.

Noor is a single inline SVG in `features/tutorial.js` with three faces (happy,
wide-eyed, winking) and a themed palette — gold metal, warm glass in the light
theme and a dark glass with a lit face in the dark one. She is also the icon on
the Settings row that reopens the tour.

### Habits cost XP

A habit has a difficulty, difficulty has a price, and you open with **160 XP**.
That buys three easy habits, or a moderate and a light and an easy, or exactly
one hard one and nothing else. The advice this app has given since its first
screen — *start with two or three* — stops being advice you can wave past and
becomes the shape of the choice.

| Tier | Cost | Library |
|---|---|---|
| Easy | 20 | 8 |
| Light | 45 | 13 |
| Moderate | 90 | 10 |
| Hard | 160 | 6 |
| Severe | 260 | 2 |

**Two ledgers, not one.** `game.xp` is lifetime earned: it drives the level and
still only ever goes up. `invested()` is what your active habits are holding.
Balance is the difference. This mattered — XP already unlocks habit slots
through the level, so a single ledger would have let you buy a habit, drop a
level and lose the slot the habit needed.

**Archiving refunds in full**, because the budget is derived from the active set
rather than deducted from a counter. XP is therefore something you *commit*, not
something you burn: every choice is reversible, the level never moves, and
`game.js`'s rule that nothing may subtract XP survives intact. Editing a habit
upward charges only the difference.

### A stake

Name a consequence for a fully missed day — sadaqah, extra rakats, anything you
will follow through on — and the app keeps the ledger.

This is the best-evidenced mechanic here. Giné, Karlan and Zinman gave smokers a
savings account they forfeited on failing a six-month test; quit rates rose by
roughly a third, and the effect was still measurable at twelve months, after the
account was gone. A reminder competes with how you feel. A stake does not care
how you feel.

Three deliberate limits. **A partial day never counts** — the two-minute version
is showing up, and charging for it would punish the thing that keeps habits
alive. **Catch-up is capped at fourteen days**, because returning after a long
gap to a bill you cannot face is how people close an app for good. And **nothing
is automatic**: the app records what you owe, you settle it in the world, and you
can lower or cancel the rule whenever you like — a stake you cannot escape makes
lying to your own tracker the rational move.

### Your own voice

Record up to thirty seconds while you are calm. It plays back from the SOS
screen, on the card with the written lines.

Text is read in your own flat internal narrator — the same voice already losing
the argument at that moment. A recording arrives with the conviction you had
when you made it, and cannot be dismissed as generic because it is audibly you.

The clip lives in IndexedDB, not `localStorage`: audio would blow the 5MB string
quota that holds every habit log in this app. It is deliberately **not** part of
the JSON backup either — a file you might email yourself should not carry your
voice in it.

### Why you started

`profile.why` — described in the schema since the first version as *"the one
paragraph read back on hard days"* — was collected in onboarding, editable in
Settings, and displayed **nowhere**. Written down and buried.

It now appears on the **SOS screen**, alongside a second line, `profile.forWhom`:
the person you are trying to be ready for. That placement is the whole point.
Neither line is worth much on a calm morning; both are worth a great deal in the
ninety seconds where an urge decides the day. The card closes with the only
argument that works in that moment — *you wrote this when you were thinking
clearly, and that version of you knew something this minute does not.*

Both lines are optional and neither is invented. If you have written neither,
no card renders — an empty prompt would be worse than nothing. They live on the
device like everything else, and they appear on that one screen rather than
anywhere someone could read them over your shoulder.

`MOTIVATIONS` gained a matching entry, so it can also be picked during
onboarding: **becoming someone worth marrying**. It sits naturally beside the
marriage horizon on the Me screen, which was already counting the weeks.

### Confetti

Level-ups get a burst — `ui/confetti.js`, ninety paper rectangles on one canvas
rather than ninety DOM nodes, since that would thrash layout on a phone for the
same picture. Palette is the app's own, so it looks like it belongs to the thing
that fired it. Physics is gravity plus drag plus a per-piece tumble, and each
piece squashes vertically as it turns edge-on, which is most of what makes paper
read as paper.

`prefers-reduced-motion` skips it entirely. Nothing else in the app fires it:
a celebration that happens constantly stops being one.

### Sound, synthesised

There are no audio files. This app ships as static files with no build step and
keeps everything on the device; a folder of `.mp3`s would work against all of
that — bytes to download, a cache to version, a licence to track. `core/audio.js`
is fourteen sounds built from a few oscillators and an envelope each, about 4KB
of code and nothing at runtime.

Two rules about how they sound:

- **Nothing is punitive.** There is no buzzer and no failure sting. Unticking a
  habit makes a soft neutral tone, because a tracker that scolds you is one you
  start lying to.
- **Shield is not celebratory.** Outlasting an urge earns a warm resolving tone,
  not the bright arpeggio a level-up gets. The two should not sound alike.

Everything is pentatonic, so two sounds that overlap cannot land on a dissonance.
Sound sits next to Vibration in Settings and is on by default; the browser will
not start an audio context outside a user gesture, so the first tap anywhere
unlocks it.

Because the sounds are data rather than files, they can be rendered and measured
without a speaker — an `OfflineAudioContext` runs the same `schedule()` the app
uses and hands back the samples, which is how the peaks below were checked.

### No emoji

Emoji were doing the icon job badly: they render as a different picture on every
platform, they carry their own colour so they ignore both the theme and the
category tint, their weights do not match each other, and half of them are a
picture of an object rather than of the idea.

`ui/icons.js` replaces them — 54 inline SVGs on one 24px grid. They are
**duotone**: a wash of `currentColor` at low opacity behind a 2.4 stroke of it.
One colour, two weights, which is what gives them the density the rest of this
app has — the first attempt was 2.1px hairline outlines, technically fine and
completely wrong for a design language whose own note reads *"very round, very
bold, and physical. Nothing is subtle."*

Both layers inherit, so a category tint, a white icon on a coloured quest node
and a dark theme are all the same asset with one CSS property changed. The wash
lifts from .18 to .32 on solid discs, where it would otherwise sink into the
fill. Roughly 180 emoji escapes went; the ones left are text rather than
decoration (the Arabic, the scripture, the ﷺ ligature).

Two collapses came with it. A habit no longer carries a picture of its own: it
draws its **category's** icon, so 51 hand-picked library emoji became six, and
what you see in the library is what you get on Today — which was not true
before. A quest node draws its **attribute's** icon, replacing 38 more.

### The bell

The top bar has a bell, and it holds everything with a date attached in one
place — `core/upcoming.js` gathers four sources the app previously kept on four
separate screens:

- **Quests** — a tier you can claim now, or one repetition away
- **Habits** — a chain one miss from breaking, and what is still open late in the day
- **Uni** — attendance about to go short, overdue and upcoming deadlines, a class
  waiting to be marked
- **Dates** — semester end, graduation, the marriage date, the weekly review, and
  the return screen after a gap

Sorted by urgency and then by how soon. The badge counts only what wants doing,
not the whole list. Dismissals last **one day**: it is a nudge, not an inbox you
can clear while the attendance it warned about keeps sliding.

### Five tabs, and the middle one is you

The bottom bar is **Today · Quests · [Me] · Uni · Shield**, with Me raised on a
disc in the exact centre — measured at 0px from the bar's midpoint. A centre
only exists with an odd slot count, so Focus gave up its tab; it is launched
from a row on Today instead and its routes are untouched. If a focus block is
already running, a live row appears above the habits so a counting timer is
never stranded behind a drawer.

The disc rests on the same solid coloured edge every pressable thing in this app
sits on, and presses down into it, so it reads as part of the set rather than a
floating action button borrowed from another design language. Every tab is now
labelled, which is what let the bar get *shorter* (68px → 62px) rather than
taller.

### Records, and the Clock

Two screens under **Me**, both built entirely from data the app has been
recording since its first version and never once read back.

**Records** is a page on which no number can go down. Total completions, best
day, best week, best month, perfect days and the longest run of them, longest
chain on any one habit, how often you did the full version rather than the
two-minute one, and how many habits are past the 66-day marker. A streak exists
to be lost, which makes it the worst thing to look at on the day you most need
to open the app; a record is a ceiling, so this is the page that is safe to open
after a bad week.

It ends with the **comeback record**: *you have fallen off 3 times, and come back
all 3.* Those are the same number, and they always will be for anyone alive to
read it. That is arithmetic rather than encouragement, which is the only reason
it is worth printing.

**The Clock** reads the `at` timestamp stored on every completion — dead data
until now — and draws a 24-hour dial of when you actually finish things, plus a
line per habit showing its median time and how tightly it clusters. The spread
is an interquartile range, so one 3am outlier cannot describe a habit you
otherwise do at the same time every morning.

That spread is the useful part: a habit with a tight time has a cue doing the
work, and one smeared across eight hours is one you are still deciding about
every day — and deciding is the part that fails on a bad week. So the tight ones
are safe and the scattered ones are the ones to anchor. The dial starts at the
app's 4am day boundary rather than midnight, so a habit logged at 1am sits at
the end of the day it belonged to.

### Coming back after two days off

The failure mode that actually ends attempts is not a missed day. It is two
missed days, after which the routine is gone and the app becomes a monument to
having failed at it. So two full days missed opens a **return screen** before
anything else, and it does four things, each with something behind it:

- **It refuses the characterological reading.** Marlatt's abstinence violation
  effect: a lapse becomes a collapse when it is read as evidence about the
  person rather than about the week. The screen leads with days logged, habits
  done and XP kept — none of which went down — and says the gap is a gap.
- **It asks what got in the way**, from six situational options. Not one of them
  is a verdict about you, which is the entire point. Repeated causes surface as
  a pattern.
- **It takes a coping plan.** Action planning is "when and where will I do
  this"; coping planning is "what will I do when something stops me", and the
  two are separable — Sniehotta et al. found coping planning predicted exercise
  months later over and above action planning and intention. One if–then line,
  which also lands in Shield's plan list when that section is on.
- **It makes the first days back smaller.** Opt in, and the lapsed habits ask
  only for their two-minute version for three days, counting in full, then
  return to normal on their own. Temporary and opt-in on purpose: a habit that
  silently redefined itself would be worse than useless.

The threshold is *days missed*, not days away, and those are not the same
number — a last log two days back means exactly one day was missed, because
today has not finished yet. One miss is not a lapse and is not treated as one.

### Reps has no streak, on purpose

Every other counter in this app is a chain of some kind. The training screen
deliberately has none, and that is the design rather than an omission.

- **A missed day is a non-event.** Nothing decays, nothing turns red, nothing is
  subtracted. The chart draws a rest day as a flat grey tick, never as a gap and
  never as damage.
- **Everything counted only goes up**: days trained, points banked, best set on
  each rung, how far up each ladder you stand. Take a fortnight off and come back
  to exactly the numbers you left.
- **Under the target still counts.** Three push-ups scores three push-ups, pro
  rata. A bad day is a small bar, not an absent one.

The one number that answers "is this actually working" is a weekly points total
compared with the week before. Points are per-rung rather than per-rep — ten wall
push-ups and ten real push-ups are not the same work — so the line moves when you
get **stronger**, not only when you do more. That is also what makes the ladder
worth climbing: the same rep count scores more the moment you move up a rung.

Stepping up is always an offer and never automatic. Clear a rung's target in one
set on three separate days inside four weeks and the app says so, once. Say "not
yet" and it stops having an opinion until you move. Stepping *down* is a free
move the app will never argue with.

Reps pays XP into **Jasad** (Body), per point of work, with a daily ceiling of 45
— about three habits' worth. Training a full session is one of the better things
you can do with an evening; it is still not worth more than the rest of the day
put together. It is free, permanently, and is listed as such in the Vault.

### Habit slots

You start with **three** habit slots. More open at levels 5, 10, 16, 24, 34 and
46 — the same thresholds the ranks use, so the two progressions agree instead of
running on separate numbers.

A slot your level has opened still will not let you fill it while a habit you
already have is below 50% over three weeks. That is the part that stops a new
habit quietly replacing an old one instead of joining it: the game pays for
keeping, not for collecting. Habits younger than two weeks are exempt, because
judging a habit before it has had time to automate is noise.

The cap is on how many run **at once**, never on which habit you are allowed to
want — archiving one to add another works at any level.

Why a cap at all: automaticity takes roughly two months per habit, and goals
pursued at the same time compete for the same attention. Three is a defensible
opening number, not a discovered one, and the app says so.

### Today is only habits

The home screen answers one question and refuses the others. Above the habits
there is a day ring, the next prayer, and — if Shield is on — the SOS button.
Everything else the app knows about today (classes, deadlines, side quests, the
shutdown ritual, the ledger, the passage) lives in a single **More today**
drawer below them, collapsed by default.

Measured on a realistic profile — three habits, university on, Shield on — that
took the screen from **3.9 phone-screens to 1.06**, from 22 top-level blocks to
9, and moved the habits from 7.5% of the page to just over half of it. A habit
tracker that costs a scrolling session every morning is not a habit tracker.

### One streak, one progression

There used to be three streaks — the per-habit chain, an app-wide "day streak",
and Shield's clean-day count — sitting next to each other in a four-chip top
bar. Three numbers all claiming to mean *progress* means none of them does.

The per-habit chain is the only one you can act on, so it is the only one left.
It lives on the habit row, where the habit it belongs to is. The day streak is
**gone from the code**, not just hidden: "at least one habit today" is a
participation trophy you can hold for a hundred days doing the easiest thing on
your list, and next to real chains it only diluted them. Shield's clean-day
count stays where it means something — the Shield tab, the SOS row, and Me.

The top bar is now two chips of one system: XP, and the level it buys.

Ranks kept the same treatment. Seven named ranks on top of levels on top of five
attributes is three progression systems for one behaviour. Ranks are now flavour
on the **Me** screen and nowhere else — the ladder on the quest board is gone,
the level-up screen names the level rather than the rank, and `heroCard` only
renders a rank when it is asked to (`{ rank: true }`).

### Grey text lives behind a "?"

Explanatory copy is worth having and not worth reading every day. Left on the
screen it becomes grey noise you learn to scroll past, and it pushes the thing
you actually came to do further down. So the standing copy was cut and moved
behind `qa()` / `qaRow()` from `ui/dom.js`: the row is the tap target, the
explanation is one tap away, and it is built on `<details>` so it needs no
JavaScript and no state.

Four kinds of grey text stayed visible on purpose, because they are not
commentary: form hints, which are read at the moment of typing; breadcrumbs,
timestamps and counts, which are data; the "when an app is not enough" notice on
Shield, because safety copy is never hidden behind a tap; and the evidence index,
where the prose *is* the content.

### Horizons

One picture, not three widgets. The life grid is the same sparse grid it has
always been — around 900 blocks, each covering about a month — but every block
is now coloured by which phase of your life those weeks belong to, so the degree
and the marriage date are **bands inside the life grid** rather than separate
cards. It is the only way to see that a four-year degree is a thin stripe, or
that almost all of married life is still blank.

| Colour | Phase |
|---|---|
| grey | already spent |
| solid blue | university, done |
| light blue | university, still to come |
| orange | the week you are in |
| green | between now and the marriage date |
| solid purple | the week itself |
| light purple | after marriage |

Underneath, a legend names every colour and gives its count: weeks spent, weeks
of the degree done and left, weeks until the date, weeks after it, and your age
when it arrives. Any horizon you have not given dates to becomes a dashed swatch
that links to Settings — nothing is estimated on your behalf.

Phases are worked out one week at a time — priority runs current week → marriage
week → university band → past → after marriage → unclaimed — and only then
grouped into the blocks that get drawn. That separation is what lets the grid
stay readable while the counts underneath it stay in whole weeks. A block takes
whichever phase fills most of it, except that the week you are in and the week
you marry win outright so a single-week marker can never vanish inside its
block. The two university figures come from the dates rather than from the
blocks, so a marriage week landing inside the degree cannot shave a week off the
answer.

The maths lives in `core/horizons.js` and is pure: give it two day keys and it
gives you weeks, or `null` if it does not have enough to be honest about.

### Side quests are themed

Every side quest carries one of five themes — **Spiritual, Physical, Mental,
Discipline, Time** — shown as a coloured chip on the card. The three daily offers
are always drawn from three *different* themes, so a day never offers you three
variations on the same thing, and no side of your life goes unrepresented.

### Levels and attributes

XP feeds one account level and five attributes that level separately. (The rank
names — Mubtadi → Saalik → Mujtahid → Muraabit → Saabir → Mustaqim → Muhsin —
still exist, but only as flavour on the Me screen; see *One streak, one
progression* above.)

| Attribute | | Fed by |
|---|---|---|
| **Ruh** | Spirit | worship habits |
| **Jasad** | Body | body habits |
| **Aql** | Mind | mind habits, focus blocks, reviews |
| **Sabr** | Restraint | purity habits, urges outlasted |
| **Waqt** | Time | work and sleep habits, shutdowns |

Streaks act as an XP multiplier, topping out at ×2 at 66 days.

---

## FAST-NUCES academics

Set up your semester once (campus, programme, first and last day of classes,
attendance threshold), add your courses with their weekly timetable slots, and
the rest follows.

**Attendance, answered as a number.** Rather than a percentage you have to
decode at 8am, each course tells you how many more classes you may still miss
before you drop below the threshold. It comes from your timetable and your
semester dates, and it excludes anything you marked cancelled or excused.
Today's classes appear on the Today screen with one-tap Present / Absent.

**Where you actually stand.** Enter marks per component and the app weights them
by that course's own scheme, showing your percentage across *only what has been
marked* — the honest number — plus what you would need to average across what is
left to finish on a target.

**GPA and CGPA** on the NUCES 4.0 scale (A 4.00, A- 3.67, B+ 3.33 … F 0.00),
credit-hour weighted, with past semesters banked into a running CGPA.

**Deadlines** for assignments, quizzes, sessionals, projects and finals, which
surface on Today alongside everything else and go red when overdue.

Two academic quest chains come with it: **The Scholar** (classes attended) and
**On Time** (deadlines closed out).

### Two numbers you must confirm yourself

This matters, so it is also said inside the app:

- **Assessment weightages are set per course by your instructor.** The app ships
  a common split (Quizzes 10 / Assignments 10 / Sessional I 15 / Sessional II 15
  / Project 10 / Final 40) purely as a starting point. Copy the real ones off
  your course outline — the projections are only as good as these numbers.
- **The attendance threshold is set by your programme.** It defaults to 80%,
  which is the figure commonly applied at FAST, but check it against the student
  handbook and change it in Settings if yours differs.

The app enforces whatever you tell it. It does not claim to know your
university's rules better than your own course outline does.

Grades are never auto-assigned from percentages, because FAST grades most
courses relatively — an indicative absolute band is shown, clearly labelled as a
rough marker rather than a prediction.

## Rules the app will not break

1. **Nothing ever subtracts XP.** Not a missed day, not an undo, not a lapse.
   Loss framing is what turns one bad day into a bad month.
2. **Lifetime clean days never go down.** A relapse ends a streak; it does not
   delete your history.
3. **Logging honestly earns XP** — including logging a lapse, and including
   every entry in the ledger. If truth costs you points, you stop telling it,
   and a tracker you lie to is worse than none.
4. **One missed day is not a failure.** The app flags it and offers the
   two-minute version instead of scolding you.
5. **Everything stays on your phone.**

---

## The evidence

Every mechanic is tied to published work, listed in-app under **Me → The
evidence** with citations, including where the popular version of a finding
overstates it. The main ones:

- Implementation intentions — Gollwitzer (1999); Gollwitzer & Sheeran (2006)
- Habit formation timeline and missed days — Lally et al. (2010)
- Progress monitoring — Harkin et al. (2016)
- Context over intention — Wood & Neal (2007)
- Urge surfing and relapse prevention — Marlatt & Gordon (1985); Bowen et al. (2011)
- Abstinence violation effect and self-compassion — Marlatt; Breines & Chen (2012)
- Behavioural activation — Jacobson et al. (1996); Dimidjian et al. (2006)
- Exercise and depression — Schuch et al. (2016)
- Sleep regularity — Windred et al. (2024)
- Temptation bundling — Milkman, Minson & Volpp (2014)
- Fresh-start effect — Dai, Milkman & Riis (2014)
- Gratitude — Emmons & McCullough (2003)

Qur'an and hadith references are given in full so you can check them against a
mushaf or a hadith database. Translations are conveyed meanings, not the Qur'an
itself.

---

## Two honest limitations

**Reminders.** A home-screen web app can notify you while it is open or recently
alive, but Android does not let it schedule alarms days ahead the way a Play
Store app can. For anything that absolutely must not be missed — Fajr above all —
**set a normal phone alarm as well.** The app says this in Settings rather than
promising something that will fail at 5am.

**Backups.** Your data lives in this browser's storage on this phone. Clearing
Chrome's site data deletes it. Use **Settings → Export backup** now and then and
keep the file somewhere safe. Import restores it on any device.

---

## Code layout

```
index.html            app shell
manifest.webmanifest  PWA metadata (icon, name, standalone display)
sw.js                 service worker — offline caching
icons/                generated app icons
src/
  main.js             boot, nav, level-up effects, install prompt
  core/
    store.js          the only thing that touches localStorage
    schema.js         every persisted field, with defaults + migrations hook
    dates.js          all day maths (day rolls over at 4am, not midnight)
    habits.js         due-logic, streaks, logging, XP payout
    game.js           XP curve, levels, ranks, attributes
    quests.js         evaluates quest goals against your real logs
    recovery.js       Shield engine — clean streak, urges, triggers, patterns
    ledger.js         muhasabah entries, corrections, patterns
    academics.js      courses, attendance maths, marks, GPA
    horizons.js       week maths for the life / degree / marriage countdowns
    comeback.js       the return protocol, easy mode, and the slot ceiling
    stats.js          records, comeback totals, and the time-of-day clock
    upcoming.js       every dated thing, gathered for the top-bar bell
    audio.js          the fourteen sounds, synthesised, no asset files
    economy.js        habit difficulty, prices, and the two XP ledgers
    stake.js          the commitment device and its ledger
    voice.js          recording, storing and playing your own message
    training.js       the reps ladders: rounds, scoring, step-ups, no streak
    prayer.js         prayer times computed offline from solar position
    router.js         hash router
    notify.js         reminders
  data/
    library.js        the habit library
    quests.js         every quest, as data
    research.js       the evidence index
    scripture.js      Qur'an and hadith, tagged by the moment they surface
    fast.js           FAST-NUCES grade scale, weightage defaults, campuses
    exercises.js      five movement ladders, six rungs each, and the preset rounds
  ui/
    styles.css        design system
    dom.js            h/raw templating, sheets, toasts, haptics
    icons.js          the inline-SVG icon set that replaced the emoji
    confetti.js       the level-up burst, one canvas, no library
    widgets.js        fragments shared across screens
  features/           one file per screen
                      tutorial.js holds Noor and the card tour,
                      coach.js the overlay that points at real controls
dev-server.py         static server with no-store, so edits are never cached
```

Quest progress is **derived** from your logs, never stored separately, so it can
never desync. Streaks have exactly one definition, in `core/habits.js`, so the
number on Today and the number on Me can never disagree.

### Editing it

There is no build step. Edit a file, refresh, done. If a change does not appear
on your phone, the service worker is serving the old cached copy — close the app
fully and reopen it, and it will pick up the update.
