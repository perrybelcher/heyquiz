import type { Instrumentation } from 'next';
import { recordFailure } from './lib/diagnostics';

// Framework-caught render/route failures otherwise bypass the API error helper.
// Deliberately omit error/request objects: they may contain personal quiz data.
export const onRequestError: Instrumentation.onRequestError = () => {
  recordFailure('server');
};
