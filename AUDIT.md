# UX & Technical Audit

## Discoverability & Onboarding
The core scanning feature lacks self-serve access from the landing page; "Get Started" and "Log In" CTAs are confusingly similar, leading to sales-led onboarding without clear role differentiation (patient vs. dentist). Static screenshots fail to provide an interactive preview (e.g., demo video), leaving users without a sense of the practical workflow and reducing confidence.

## Scanner UX (Core Experience)
Capture area is oversized, requiring scrolling on desktop and disrupting real-timegit interaction. Instructional overlays conflict with camera views, lacking actionable feedback on distance, alignment, or stability. Auto-capture with countdown exists but offers no retake, delete, or review options, leaving users without control over errors.

## Control vs Automation Balance
The flow leans heavily on auto-capture without user agency—pre-submit validation and quality indicators are absent, risking poor inputs that degrade AI results.

## Loading & Results Perception
Post-submission lacks progress feedback, making waits feel interminable. High-confidence scores (e.g., 100%) clash with "not medical advice" disclaimers, eroding trust. "Talk to a dentist" transitions feel abrupt without context.

## Trust & Consistency
Visual inconsistencies between scan and result screens break branding. Misleading affordances (e.g., non-clickable dots/arrows on "Steps") and unpredictable navigation (e.g., "Case Studies" linking to FAQ) undermine reliability.

## Technical Risks & Mobile Camera Stability
Browser/device variability in `getUserMedia` (e.g., iOS Safari restrictions) risks access failures. Hand tremors, lighting changes, and distance errors produce unstable, blurry captures without real-time stabilization. Video stream processing drains battery and overheats low-end devices; base64 image storage consumes memory; network uploads may fail without retries. AI accuracy hinges on input quality, amplifying these risks.

## Recommendations for Smoother Experience
Add guided demos, responsive overlays, quality feedback, user controls (retake/review), progress indicators, and consistent UI. Prioritize camera stabilization via motion detection and cross-browser fallbacks.
