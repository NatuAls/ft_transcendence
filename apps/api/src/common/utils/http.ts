/**
 * Express 5 types every route param as `string | string[]` (to accommodate
 * repeating patterns like `/:id+`), even though a plain named param like
 * `:id` is always a single string at runtime. Route handlers use this to say
 * "yes, I know - take the single value" without an inline cast at every call
 * site.
 */
export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}
