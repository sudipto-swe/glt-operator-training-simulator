/**
 * Public engine API. The engine is deliberately framework-free: React code
 * imports only from this barrel, and the engine itself imports nothing from
 * the UI layer.
 */
export * from './types';
export * from './constants';
export * from './rng';
export * from './events';
export * from './faults';
export * from './alarms';
export * from './loto';
export * from './engine';
export * from './scoring';
