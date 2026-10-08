import type { YogaStep, YogaFlow } from '../src/yoga-types';
export function stepSeconds(step: YogaStep): number;
export function flowSeconds(flow: Pick<YogaFlow, 'sections'>): number;
export function sessionPhases(step: YogaStep): {label: string; seconds: number}[];
