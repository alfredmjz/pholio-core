import { mock } from "bun:test";

/**
 * Bun's module mocks last for the whole test run and leak into later files, whose order differs
 * between Bun versions and machines. Keep every real export and replace only the named ones.
 */
export async function mockModule(path: string, overrides: Record<string, unknown>): Promise<void> {
	const real = await import(path);
	mock.module(path, () => ({ ...real, ...overrides }));
}
