// get user name regardless of ASCII or Unicode
export function normalizeUsername(input: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch (e) {
    decoded = input;
  }
  decoded = decoded.replace(/\d+$/, "");
  return decoded.trim();
}
