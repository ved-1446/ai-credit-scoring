# Hyperframes Composition Brief: Data Dynamo

## Objective
Create a ~30s polished launch-style brag video for Data Dynamo (AI credit-scoring demo).

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape - 1920x1080
- Duration: 30s (user override of the 15-25s default)

## Source Material
- Project root: C:\Dev\data-dynamo
- Primary files read: README.md, frontend/src/pages/Landing.jsx, frontend/src/index.css, frontend/src/constants/{text,risk,samples}.js, frontend/src/components/result/RiskScale.jsx, backend/app/ml/feature_dictionary.json
- Product name: Data Dynamo
- Strongest claim: "Transparent, machine-learning powered credit risk evaluation" + the "Honest Limits" section
- Key UI moments to recreate: typed landing title, application form fill, risk continuum bar with cut-off, factor rows, honesty stats
- Copy that must appear verbatim:
  - AI CREDIT SCORING SYSTEM
  - Transparent, machine-learning powered credit risk evaluation
  - Agree to data use / Fill in application / See factors & risk
  - Educational demo. Not a real lending decision.
  - 0.6974 test ROC-AUC; 2.84% / 7.56% / 18.28% / 30.88%

## Creative Direction
- Tone preset: polished
- Creative direction: clean and confident
- Interpretation: few scenes, 0.6s crossfades, generous holds, mixed-case type, no jokes
- Angle / Hook / Outro: see brag-plan.md
- Avoid: generic SaaS language, abstract filler, invented numbers

## Visual Identity
- Background #161917, cards #1F2320, borders #2C312D
- Text #F5F6F1, muted #969D96; accent teal #5EC4B4 (button #148074); terracotta #E08A66
- Risk fills: #4AC58E / #E6BE46 / #F08C46 / #EB5A64
- Display Fraunces, body DM Sans, mono JetBrains Mono (local woff2 in assets/fonts)

## Storyboard
See brag-plan.md (5 scenes: 5.5 / 6.5 / 8 / 6 / 4 seconds, overlapped by 0.6s crossfades).

## Audio
- Role: warm bed with sparse accents
- Music: assets/music/bed.mp3 (Happy Beats Business Moves Vol. 1, ~120 BPM), vol ~0.35, fade-in 1s, fade-out 3s
- Cue guidance: bundled preset; beat grid ~0.5s from 3.02s (extended past 25s); lock 16.02s (factor row 3) and 20.02s ("The model is weak.")
- Audio-reactive: skipped, media-use extraction helper not available in this environment (documented)
- SFX: keypress ticks on title typing, click on the two button presses, rollover on factor rows, soft impact on the honesty headline, bong on the logo. Low high-frequency-risk files only (per sfx-analysis.md).
