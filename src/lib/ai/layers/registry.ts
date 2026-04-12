import type { ContextLayer } from './types';
import { l1DomainLayer } from './l1-domain';
import { l2ClientLayer } from './l2-client';
import { l3ProcessLayer } from './l3-process';
import { l4SessionLayer } from './l4-session';

const layers: Record<string, ContextLayer<any>> = {
  'l1-domain': l1DomainLayer,
  'l2-client': l2ClientLayer,
  'l3-process': l3ProcessLayer,
  'l4-session': l4SessionLayer,
};

export function getLayer(name: string): ContextLayer<any> {
  const layer = layers[name];
  if (!layer) {
    throw new Error(
      `Unknown layer: "${name}". Available: ${Object.keys(layers).join(', ')}`
    );
  }
  return layer;
}
