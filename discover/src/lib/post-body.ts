export function isRichHtml(input: string): boolean {
  const source = String(input || "");
  return /<[a-z][\s\S]*?>/i.test(source);
}
