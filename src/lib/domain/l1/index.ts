import procurement from './procurement.json'
import unknown from './unknown.json'

export interface L1Step {
  name: string
  description: string
  typicalSystems: string[]
}

export interface L1EdgeCase {
  description: string
  frequency: string
}

export interface L1Domain {
  type: string
  label: string
  typicalSteps: L1Step[]
  commonEdgeCases: L1EdgeCase[]
  commonSystems: string[]
  industryVariations: Record<string, string>
}

const domains: Record<string, L1Domain> = {
  procurement,
  unknown,
}

export function getL1(type: string): L1Domain {
  return domains[type] ?? domains['unknown']
}

export function getAllL1Types(): string[] {
  return Object.keys(domains)
}

export function getAllL1Domains(): L1Domain[] {
  return Object.values(domains)
}
