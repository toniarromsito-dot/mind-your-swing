/**
 * Interpola una plantilla tipo "Hoyo {n}" con valores. Se usa en vez de
 * funciones en el diccionario porque las funciones no se pueden pasar
 * de un Server Component a un Client Component como prop.
 */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}
