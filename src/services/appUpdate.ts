import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import { getApiData } from './http';

const APP_UPDATE_URL = 'https://huangwu.xin/api/v1/app-version';
const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export type AppUpdateInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string[];
  force?: boolean;
};

export type AppUpdateDownloadProgress = number | null;

export async function checkForAppUpdate() {
  const update = await getApiData<AppUpdateInfo>(
    APP_UPDATE_URL,
    '检查更新失败',
  );
  const currentVersionCode = Number(Application.nativeBuildVersion);

  return update.versionCode > currentVersionCode ? update : null;
}

export async function downloadAndInstallAppUpdate(
  update: AppUpdateInfo,
  onProgress: (progress: AppUpdateDownloadProgress) => void,
) {
  if (!FileSystem.cacheDirectory) {
    throw new Error('无法访问下载目录');
  }

  const targetUri = `${FileSystem.cacheDirectory}voice-book-${update.versionCode}.apk`;
  const download = FileSystem.createDownloadResumable(
    update.apkUrl,
    targetUri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      onProgress(
        totalBytesExpectedToWrite > 0
          ? totalBytesWritten / totalBytesExpectedToWrite
          : null,
      );
    },
  );
  const result = await download.downloadAsync();

  if (!result) {
    throw new Error('下载已取消');
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: APK_MIME_TYPE,
  });
}
