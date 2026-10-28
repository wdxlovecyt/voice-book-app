import { getCachedUrlChildNames, getOrFetchCachedValue } from './cache';

type ApiResponse<T> = {
  data: T;
};

type RequestOptions = {
  cache?: boolean;
};

export async function getApiData<T>(
  url: string,
  errorLabel: string,
  options: RequestOptions = {},
) {
  const request = async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${errorLabel}：${response.status}`);
    }

    const result = (await response.json()) as ApiResponse<T>;
    return result.data;
  };

  return options.cache ? getOrFetchCachedValue(url, request) : request();
}

export function getCachedApiChildNames(url: string) {
  return getCachedUrlChildNames(url);
}
