import { File, Paths } from 'expo-file-system';

const HISTORY_FILE = new File(Paths.document, 'search-history.json');
const MAX_HISTORY_ITEMS = 10;

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_HISTORY_ITEMS);
}

export async function getSearchHistory() {
  try {
    if (!HISTORY_FILE.exists) {
      return [];
    }

    return normalizeHistory(JSON.parse(await HISTORY_FILE.text()));
  } catch {
    return [];
  }
}

export async function saveSearchHistory(keyword: string) {
  const value = keyword.trim();
  if (!value) {
    return [];
  }

  const history = await getSearchHistory();
  const nextHistory = [
    value,
    ...history.filter((item) => item !== value),
  ].slice(0, MAX_HISTORY_ITEMS);

  HISTORY_FILE.create({ intermediates: true, overwrite: true });
  HISTORY_FILE.write(JSON.stringify(nextHistory));

  return nextHistory;
}
