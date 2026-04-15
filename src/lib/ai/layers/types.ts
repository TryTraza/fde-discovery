export type {
  ContextLayer,
  LayerParams,
  LayerResult,
  L1Options,
  L2Options,
  L3Options,
  L4Options,
} from '@/lib/ai/types';

import type { LayerResult } from '@/lib/ai/types';

export const EMPTY_LAYER_RESULT: LayerResult = { data: {}, templateVars: {} };
