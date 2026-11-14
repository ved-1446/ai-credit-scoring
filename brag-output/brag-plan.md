# Brag Plan: Data Dynamo

## What is this app?
A full-stack ML credit-scoring web app that estimates an applicant's default risk with an XGBoost model, explains the factors behind it in plain language (SHAP), and states its own limits openly.

## The angle
A credit score that shows its work, including where the work is weak. Most impressive thing in the repo: the product does not hide the model's limits. The README's "Honest Limits" and the admin Fairness page publish the weak AUC and the gender-ratio shortfall. Confident, not boastful: the video states real numbers and lets them stand.

## Hook (0-5.5s)
"AI CREDIT SCORING SYSTEM" types out character by character with a teal caret, exactly as the landing page does. Kicker: "Data Dynamo / Simulation Engine". Line under it (from the landing page): "Transparent, machine-learning powered credit risk evaluation."

## Key moments
1. **The flow (5.5-12s):** the three landing steps "Agree to data use / Fill in application / See factors & risk" as a progress rail; a form card fills in (the "Fill with a sample applicant" button is clicked, fields populate, then "Submit & Evaluate Risk").
2. **The result (12-20s):** risk scale with the four bands and the real review cut-off (13.15%); a marker slides onto the scale; the main factors appear one by one with the app's own plain names and direction (External credit score 2/3, Loan amount, Annual income, Annual repayment) plus the "Strong / Moderate" strength words. Small tags: English / Hindi / Marathi summary, What-If simulation, PDF report.
3. **The honesty (20-26s):** "The model is weak." with measured numbers: test ROC-AUC 0.6974; ~17 of 100 flagged actually default; ~42 of 100 defaulters caught; band default rates 2.84% / 7.56% / 18.28% / 30.88% (validation sample).

## Outro / punchline (26-30s)
"Data Dynamo" at scale. "Educational demo. Not a real lending decision." Live URL: ai-credit-scoring-theta.vercel.app. Then silence/fade.

## User flow worth showing
Consent -> fill application (27 fields, "Fill with a sample applicant") -> result with risk scale, factors and What-If.

## Tone
- Preset: polished
- Creative direction: clean and confident (user-specified)
- Interpretation: few scenes, slow crossfades (0.6s), generous holds, mixed-case type, no jokes. Confidence through stating the weak numbers plainly.

## Format: landscape - 1920x1080
## Duration: 30s (user override of the skill's 15-25s window)

## Visual identity (from frontend/src/index.css and tailwind config)
- Background: rgb(22 25 23) = #161917 (cards #1F2320, borders #2C312D)
- Accent: brand teal rgb(94 196 180) = #5EC4B4 (button #148074); secondary terracotta rgb(224 138 102) = #E08A66
- Text: #F5F6F1 (slate-50), muted #969D96
- Risk colors (fills): low #4AC58E, medium #E6BE46, high #F08C46, very high #EB5A64
- Display font: Fraunces (variable); Body font: DM Sans (variable); Mono: JetBrains Mono
- Strongest visual element: the risk continuum bar with the cut-off tick and the four band cards

## Honesty / grounding notes
- The result marker position and factor ordering are **illustrative** (the repo has no stored sample output). The video labels that scene "Illustrative sample result" and shows no specific risk percentage for the marker.
- Sample form values are from `frontend/src/constants/samples.js` ("Borderline" profile), fictional by construction.
- No real users, emails, secrets or .env content used.

## Share copy (draft)
Data Dynamo: an AI credit-scoring demo that explains every score, and publishes its own weak spots (test ROC-AUC 0.6974) instead of hiding them.

## Audio direction
- Role: warm bed with sparse professional accents
- Music: bundled "Happy Beats - Business Moves Vol. 1" (about 120 BPM), low bed, fade in over 1s, fade out over last 3s
- Music treatment: starts at 0, volume about 0.35, fade-out into outro
- Music cue guidance: bundled preset read (`happy-beats-business-moves-vol-1...music-cues.json`). Grid ~0.5s from 3.02s; preset window ends at 25s so the grid is extended at the same 0.5s spacing. Strong cues near 16.02, 17.02, 18.02, 20.02, 23.02. Lock 1-2: factor list start (~16.02) and the "The model is weak." beat (~20.02).
- Audio-reactive treatment: subtle; bass energy breathes the teal glow behind the hero and risk card, no waveform bars
- SFX posture: sparse, motion-matched: soft key ticks for typing, UI click on button presses, soft card sounds for factor rows
- Audio-coupled moments: typed title, form fill + click, factor rows one by one, stat count-ups
- Restraint rule: no sound over the honesty scene except one quiet accent; nothing loud

## Storyboard

### Scene 1 - Hook - 5.5s
Dark graphite ground, teal glow. Kicker "Data Dynamo / Simulation Engine" fades in; "AI CREDIT SCORING SYSTEM" types out (~1.7s) with caret; subline "Transparent, machine-learning powered credit risk evaluation." fades up and holds >=2s. Text hold: title >=2.5s settled, subline >=2s.
Sequential/interaction: yes - typed title.
Audio intent: calm confident open. Audio-coupled idea: soft key ticks on typing.
Music: warm bed fades in.
Transition mood: slow crossfade -> Scene 2

### Scene 2 - The flow - 6.5s
Three-step rail "01 Agree to data use / 02 Fill in application / 03 See factors & risk" lights up in turn. Form card ("Your application") with fields (Annual income 160,000; Loan amount 450,000; Annual repayment 24,000; External credit score 1/2/3 ...) fills in after a cursor clicks "Fill with a sample applicant"; "27 fields" tag; cursor then presses "Submit & Evaluate Risk".
Sequential/interaction: yes - cursor click, fields fill, submit click.
Audio intent: purposeful. Audio-coupled idea: UI click sounds on the two button presses.
Transition mood: slow crossfade -> Scene 3

### Scene 3 - The result - 8s
Card "Estimated default risk" with Risk continuum bar (Low / Medium / High / Very high), cut-off tick "Cut-off (13.15%)", marker slides in. Main factors list reveals row by row (each held ~1s): "External credit score 2 - lowers risk - Strong", "Loan amount - raises risk - Moderate", etc. Footer chips: "English / Hindi / Marathi", "What-If simulation", "PDF report". Small caption: "Illustrative sample result".
Sequential/interaction: yes - 4 factor rows arrive one by one on beats (every other beat, 1s apart so each can be read).
Audio intent: lift. Audio-coupled idea: soft card sound per row; one strong-cue lock at ~16.0s.
Transition mood: slow crossfade -> Scene 4

### Scene 4 - The honesty - 6s
Big Fraunces line "The model is weak." then "We say so." Beneath: three stats count up: "0.6974 test ROC-AUC", "~17 of 100 flagged actually default", "~42 of 100 defaulters caught", and the four band default rates as a quiet row. Hold each text >=1.5s.
Sequential/interaction: yes - stats arrive in order; count-up on numbers.
Audio intent: grounded, quiet. Music dips slightly.
Transition mood: slow crossfade -> Scene 5

### Scene 5 - Outro - 4s
"Data Dynamo" in Fraunces, teal rule, "Educational demo. Not a real lending decision.", URL "ai-credit-scoring-theta.vercel.app". Music fades out.
Sequential/interaction: none.
Audio intent: resolve.

**Music mood for this video:** warm, upbeat but restrained
**Audio summary:** quiet bed in, key ticks on the title, clicks on the form, soft card taps on the factors, dip for the honesty beat, fade out under the URL.
