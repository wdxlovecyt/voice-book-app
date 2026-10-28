import { Directory, File, Paths } from 'expo-file-system';

const inFlightRequests = new Map<string, Promise<unknown>>();

function getCacheTarget(url: string) {
  const parsedUrl = new URL(url);
  const fileName = parsedUrl.search
    ? `${encodeURIComponent(parsedUrl.search)}.json`
    : 'data.json';

  return {
    directory: [
      'api-cache',
      parsedUrl.host,
      ...parsedUrl.pathname
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent),
    ],
    fileName,
  };
}

function getCacheFile(url: string) {
  const target = getCacheTarget(url);

  return new File(
    Paths.document,
    ...target.directory.map(encodeURIComponent),
    target.fileName,
  );
}

async function getCachedValue<T>(url: string): Promise<T | null> {
  try {
    const file = getCacheFile(url);
    if (!file.exists) {
      return null;
    }

    return JSON.parse(await file.text()) as T;
  } catch {
    return null;
  }
}

function saveCachedValue<T>(url: string, value: T) {
  try {
    const file = getCacheFile(url);
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(value));
  } catch {
    // 缓存写入失败不影响网络请求结果。
  }
}

export async function getOrFetchCachedValue<T>(
  url: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cachedValue = await getCachedValue<T>(url);
  if (cachedValue !== null) {
    return cachedValue;
  }

  const existingRequest = inFlightRequests.get(url) as Promise<T> | undefined;
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetcher().then((value) => {
    saveCachedValue(url, value);
    return value;
  });
  inFlightRequests.set(url, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(url);
  }
}

export function getCachedUrlChildNames(url: string) {
  try {
    const target = getCacheTarget(url);
    const directory = new Directory(
      Paths.document,
      ...target.directory.map(encodeURIComponent),
    );

    if (!directory.exists) {
      return [];
    }

    return directory
      .list()
      .filter((item): item is Directory => item instanceof Directory)
      .map((item) => decodeURIComponent(item.name));
  } catch {
    return [];
  }
}
