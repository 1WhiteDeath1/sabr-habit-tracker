// research.js — the evidence behind every mechanic in this app.
//
// Each entry is surfaced in-app as a "why this works" card on the feature it
// justifies. Citations are real and checkable; where evidence is mixed or the
// effect is smaller than popular writing claims, the entry says so. An app that
// overstates its science is just a motivational poster with a database.

export const RESEARCH = {
  implementationIntentions: {
    id: 'implementationIntentions',
    title: 'If–then plans beat willpower',
    claim: 'Deciding in advance exactly when, where and how you will act roughly doubles follow-through compared to intention alone.',
    detail: 'Gollwitzer’s "implementation intentions" work by handing control of the behaviour to a situational cue instead of to in-the-moment motivation. The classic demonstration: students asked to name a specific time and place for a task completed it at about three times the rate of those who only intended to do it. The meta-analysis across 94 studies puts the effect at d ≈ 0.65 — large, by behavioural-science standards.',
    cite: 'Gollwitzer (1999), American Psychologist; Gollwitzer & Sheeran (2006) meta-analysis.',
    used: 'Every habit has a "When ___, I will ___" line. That line is the habit.',
  },

  habitStacking: {
    id: 'habitStacking',
    title: 'Anchor new habits to fixed ones',
    claim: 'Attaching a new behaviour to something already automatic borrows the existing cue instead of building one from scratch.',
    detail: 'Behaviour is triggered by context far more than by intention. If a behaviour has no reliable cue, it depends on you remembering and choosing — which is exactly what fails on a bad day. The five daily prayers are unusually good anchors: they already occur, they are already time-bound, and you already never negotiate about them.',
    cite: 'Wood & Neal (2007), Psychological Review; Fogg, Tiny Habits (2019).',
    used: 'Habits can be anchored to a prayer or stacked directly after another habit.',
  },

  twoMinuteRule: {
    id: 'twoMinuteRule',
    title: 'Shrink it until starting is trivial',
    claim: 'A version small enough that refusing it feels absurd keeps the chain alive on days you have nothing.',
    detail: 'Motivation is the least reliable input you have, so the design goal is to need as little of it as possible. Behaviour happens when motivation, ability and a prompt coincide — and ability is the only one of the three you can change instantly. Two minutes of Qur’an on your worst day preserves the identity; a skipped hour does not.',
    cite: 'Fogg Behaviour Model (2009); Fogg, Tiny Habits (2019).',
    used: 'Every habit stores a two-minute version. Completing it still counts, and still pays XP.',
  },

  neverMissTwice: {
    id: 'neverMissTwice',
    title: 'One missed day is not the problem',
    claim: 'Missing a single day has no measurable effect on habit formation. Missing two in a row is where it comes apart.',
    detail: 'Lally and colleagues tracked 96 people forming a new daily habit and modelled automaticity over 12 weeks. Occasional missed days did not disrupt the curve. What matters is the overall rate of repetition, not an unbroken chain — which is why this app flags a habit as "at risk" after one miss and never punishes you for it.',
    cite: 'Lally, van Jaarsveld, Potts & Wardle (2010), European Journal of Social Psychology.',
    used: 'The at-risk flag, the forgiving streak rules, and cumulative rather than consecutive quest goals.',
  },

  sixtySixDays: {
    id: 'sixtySixDays',
    title: '66 days, not 21',
    claim: 'The median time for a new behaviour to reach automaticity was 66 days, with a range from 18 to 254.',
    detail: 'The "21 days" figure is a misreading of a 1960s plastic-surgery observation and has no evidence behind it. The real number is longer, and — more usefully — it varies enormously by person and by behaviour. Drinking a glass of water automated fast; doing 50 sit-ups did not. Expect months, not weeks, and stop treating week three as a failure point.',
    cite: 'Lally et al. (2010); the 21-day claim originates in Maltz, Psycho-Cybernetics (1960).',
    used: 'Habit age is shown against the 66-day marker, and the final quest tier sits at 66.',
  },

  selfMonitoring: {
    id: 'selfMonitoring',
    title: 'Tracking itself changes behaviour',
    claim: 'Monitoring progress toward a goal measurably improves goal attainment — and more so when the record is made visible.',
    detail: 'A meta-analysis of 138 studies (19,951 participants) found prompting people to monitor progress had a reliable effect on attainment, strengthened when progress was recorded physically or reported publicly. This is the cheapest intervention in the whole field, and it is the one thing a habit app is structurally good at.',
    cite: 'Harkin et al. (2016), Psychological Bulletin.',
    used: 'The whole app. Specifically: streaks, the year grid, and the weekly review.',
  },

  urgeSurfing: {
    id: 'urgeSurfing',
    title: 'Urges peak and then fall on their own',
    claim: 'An urge is a wave, not a rising line. Observed without acting, it crests and subsides — usually well inside half an hour.',
    detail: 'Urge surfing comes from Marlatt’s relapse-prevention work and is now standard in mindfulness-based relapse prevention. You stop fighting the urge (which feeds it attention) and instead watch it as a physical sensation with a beginning, a peak and an end. Each time you ride one out without acting, the learned association weakens — this is extinction learning, and it is the actual mechanism of recovery.',
    cite: 'Marlatt & Gordon (1985), Relapse Prevention; Bowen, Chawla & Marlatt (2011), MBRP.',
    used: 'The SOS timer in Shield: a visible wave, a breath pacer, and a log at the end.',
  },

  abstinenceViolation: {
    id: 'abstinenceViolation',
    title: 'Shame after a lapse is what causes the relapse',
    claim: 'The reaction to a slip predicts the outcome far more than the slip itself does.',
    detail: 'Marlatt named this the abstinence violation effect: after breaking a commitment, people who read the lapse as proof of personal failure are markedly more likely to abandon the attempt entirely. Those who read it as a single, situational, solvable event usually recover. Self-compassion after failure increases — not decreases — motivation to improve; Breines & Chen found this experimentally across four studies.',
    cite: 'Marlatt & Gordon (1985); Breines & Chen (2012), Personality and Social Psychology Bulletin.',
    used: 'Lifetime clean days never reset, logging a lapse earns XP, and the recovery flow asks what happened rather than what is wrong with you.',
  },

  copingPlanning: {
    id: 'copingPlanning',
    title: 'Plan the recovery before you need it',
    claim: 'Planning what you will do *when* you fail predicts maintenance better than planning the behaviour alone.',
    detail: 'Action planning answers "when and where will I do this". Coping planning answers "what will I do when something stops me" — and the two are separable. Sniehotta and colleagues followed cardiac rehabilitation patients and found coping planning predicted exercise months later over and above action planning and intention. The mechanism is that the obstacle stops being a decision point: you already decided. Which is why the useful moment to write the plan is now, not during the lapse.',
    cite: 'Sniehotta, Scholz & Schwarzer (2005), Psychology & Health; Kwasnicka et al. (2016) review of maintenance theories.',
    used: 'Coming back after two days away asks for one if–then line: if this happens again, I will do this.',
  },

  oneAtATime: {
    id: 'oneAtATime',
    title: 'Few habits at once, held for longer',
    claim: 'Habits automate over roughly two months each, and goals pursued at the same time compete for the same attention.',
    detail: 'The Lally data puts the median time to automaticity at 66 days, with a very wide spread. Starting six habits does not run six 66-day clocks in parallel: activating one goal measurably inhibits the accessibility of competing goals, so each gets a thinner slice of the attention that repetition needs. The honest version of this finding is a constraint, not a rule — it says hold a small set until it is genuinely automatic, and it does not say what the right number is. Three is a defensible starting point, not a discovered one.',
    cite: 'Lally et al. (2010), European Journal of Social Psychology; Shah, Friedman & Kruglanski (2002), goal shielding, JPSP.',
    used: 'You start with three habit slots. More unlock as you level, and only open once the habits you already have are holding.',
  },

  halt: {
    id: 'halt',
    title: 'HALT: the state, not the object',
    claim: 'Most urges are a physiological or emotional state looking for the nearest exit, not a genuine desire for the thing.',
    detail: 'Hungry, Angry, Lonely, Tired. It is a clinical rule of thumb rather than a single landmark study, but the underlying findings are solid: sleep loss impairs the prefrontal control needed to resist, and negative affect is one of the most consistently identified antecedents of relapse across substances and behaviours. Naming the state usually deflates the urge, because you can address the state directly.',
    cite: 'Origin in 12-step clinical practice; supported by Marlatt’s high-risk-situation taxonomy and sleep-deprivation self-control research.',
    used: 'The SOS flow asks HALT first, before anything else.',
  },

  environmentDesign: {
    id: 'environmentDesign',
    title: 'Change the room, not your resolve',
    claim: 'Cues in your environment drive habitual behaviour more reliably than intentions do.',
    detail: 'Wood & Neal’s review makes the case that habits are context-cued responses; when the context is stable, the behaviour fires with little conscious involvement. This is why the phone in the bedroom is not a minor detail. Environment changes are one-time costs that pay out every night, while willpower is a per-night cost that rises exactly when you are most tired.',
    cite: 'Wood & Neal (2007), Psychological Review; Wood, Quinn & Kashy (2002).',
    used: 'The Defences checklist in Shield, and the friction prompts in the night routine.',
  },

  temptationBundling: {
    id: 'temptationBundling',
    title: 'Bundle the thing you want with the thing you avoid',
    claim: 'Pairing an indulgence with a task you postpone increases how often you do the task.',
    detail: 'Milkman, Minson and Volpp gave gym-goers access to addictive audiobooks only at the gym. Attendance rose — 51% higher in the full-bundling condition initially, though the effect decayed over time and around 61% of participants still chose to pay for the restriction afterwards. Real, useful, and smaller than the popular retelling suggests.',
    cite: 'Milkman, Minson & Volpp (2014), Management Science.',
    used: 'Suggested when you build a habit you keep skipping.',
  },

  zeigarnik: {
    id: 'zeigarnik',
    title: 'Starting is almost the whole job',
    claim: 'Begun-but-unfinished tasks stay active in memory and pull you back toward completion.',
    detail: 'Zeigarnik’s original finding — interrupted tasks are recalled better than completed ones — has had a mixed replication record, so treat the memory claim carefully. What is robust in practice is the asymmetry of effort: the cost of a task is concentrated almost entirely at the start, and a two-minute start very often runs long. This is why the timer here starts at two minutes and not at an hour.',
    cite: 'Zeigarnik (1927); replication reviewed in Seifert & Patalano (1991).',
    used: 'The "Just Start" two-minute button on the Focus screen.',
  },

  identityHabits: {
    id: 'identityHabits',
    title: 'Aim at the identity, not the outcome',
    claim: 'Each repetition is evidence about who you are, and that self-image then drives the next repetition.',
    detail: 'Self-perception theory holds that people infer their attitudes from observing their own behaviour. Practically: "I do not do that" is a far more durable refusal than "I cannot do that right now" — and it tests better. Patrick & Hagtvedt found "I don’t" beat "I can’t" for resisting temptation across several studies. Identity is the compounding asset here.',
    cite: 'Bem (1972), self-perception theory; Patrick & Hagtvedt (2012), Journal of Consumer Research.',
    used: 'Your identity statement in onboarding, shown at every decision point.',
  },

  exerciseMood: {
    id: 'exerciseMood',
    title: 'Exercise is a real antidepressant dose',
    claim: 'Physical activity produces a moderate, reliable antidepressant effect.',
    detail: 'A meta-analysis of 25 randomised trials, adjusted for publication bias, found a large effect against control conditions for exercise in depression, with the strongest results for moderate-to-vigorous aerobic activity supervised by a professional. It is not a replacement for treatment where treatment is needed, but it is one of the few levers here that acts on mood within a single session.',
    cite: 'Schuch et al. (2016), Journal of Psychiatric Research.',
    used: 'Body habits, and the movement prompt offered when you log a low mood.',
  },

  sleepConsistency: {
    id: 'sleepConsistency',
    title: 'A fixed wake time beats a fixed bedtime',
    claim: 'Regularity of sleep timing predicts health and daytime function independently of how long you sleep.',
    detail: 'Sleep regularity has turned out to be a stronger predictor of mortality risk than sleep duration in large cohort analyses. The practical lever is the wake time and the morning light exposure that follows it, because those set tonight’s sleep pressure and circadian phase. Chasing an earlier bedtime directly rarely works; moving the wake time does.',
    cite: 'Windred et al. (2024), SLEEP; Czeisler et al. on light and circadian entrainment.',
    used: 'The night shutdown ritual and the wake-time anchor in Settings.',
  },

  freshStart: {
    id: 'freshStart',
    title: 'Temporal landmarks restart motivation',
    claim: 'People pursue goals more aggressively right after a date that feels like a boundary.',
    detail: 'Dai, Milkman and Riis found gym visits, goal-setting and search behaviour all spike after landmarks — new weeks, new months, birthdays. The mechanism is that a landmark separates you from an imperfect past self. It is worth using deliberately, and worth knowing that the effect fades, which is why this app leans on the weekly boundary rather than the annual one.',
    cite: 'Dai, Milkman & Riis (2014), Management Science.',
    used: 'The weekly review, scheduled at the week boundary.',
  },

  gratitude: {
    id: 'gratitude',
    title: 'Specific gratitude, weekly',
    claim: 'Writing what you are grateful for raises wellbeing — when it is specific and not done to exhaustion.',
    detail: 'Emmons & McCullough found weekly gratitude listing improved wellbeing and optimism relative to listing hassles. Later work suggests frequency matters: daily lists can lose their effect through habituation, and specificity matters more than quantity. Three concrete things beats ten vague ones.',
    cite: 'Emmons & McCullough (2003), Journal of Personality and Social Psychology.',
    used: 'The evening journal asks for three specific things.',
  },

  behaviouralActivation: {
    id: 'behaviouralActivation',
    title: 'Action comes before motivation',
    claim: 'Waiting to feel like it is the mistake. Scheduled action reliably lifts mood, and the motivation arrives afterwards.',
    detail: 'Behavioural activation treats low mood as maintained by withdrawal from rewarding activity, and it works by scheduling that activity regardless of how you feel. In head-to-head trials it performs comparably to full cognitive therapy for depression. This is the single most useful idea in this app for the days you cannot get started.',
    cite: 'Jacobson et al. (1996); Dimidjian et al. (2006), Journal of Consulting and Clinical Psychology.',
    used: 'The Focus screen’s framing, and the low-mood response in the journal.',
  },
};

export const RESEARCH_LIST = Object.values(RESEARCH);
