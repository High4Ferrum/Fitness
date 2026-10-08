// Timing is per repetition and per side. Transitions/rest happen after each hold.
export function stepSeconds(step) {
  if (step.overrideSeconds !== null && step.overrideSeconds !== undefined) return step.overrideSeconds;
  const hold = step.unit === 'breaths' ? step.hold * step.secondsPerBreath : step.hold;
  return (hold + step.transitionSeconds + step.restSeconds) * step.repetitions * (step.side === 'Both' ? 2 : 1);
}
export function flowSeconds(flow) { return flow.sections.reduce((sum, section) => sum + section.steps.reduce((s, step) => s + stepSeconds(step), 0), 0); }
export function sessionPhases(step) {
  if (step.overrideSeconds !== null && step.overrideSeconds !== undefined) return [{ label: `${step.side} · timing override`, seconds: step.overrideSeconds }];
  const phases = [];
  for (let round = 1; round <= step.repetitions; round++) for (const side of step.side === 'Both' ? ['Left', 'Right'] : [step.side]) {
    phases.push({ label: `${side} · round ${round}${step.unit === 'breaths' ? ` · ${step.hold} breaths` : ''}`, seconds: step.unit === 'breaths' ? step.hold * step.secondsPerBreath : step.hold });
    if (step.transitionSeconds) phases.push({ label: 'Transition', seconds: step.transitionSeconds });
    if (step.restSeconds) phases.push({ label: 'Rest', seconds: step.restSeconds });
  }
  return phases;
}
