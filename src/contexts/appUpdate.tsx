import { PropsWithChildren, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Dialog, Portal, ProgressBar, Text } from 'react-native-paper';

import {
  AppUpdateDownloadProgress,
  AppUpdateInfo,
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
} from '../services/appUpdate';

export function AppUpdateProvider({ children }: PropsWithChildren) {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<AppUpdateDownloadProgress>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    if (Platform.OS !== 'android') {
      return;
    }

    void checkForAppUpdate()
      .then((nextUpdate) => {
        if (isCurrentRequest) {
          setUpdate(nextUpdate);
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const dismissUpdate = () => {
    if (!isDownloading && !update?.force) {
      setUpdate(null);
    }
  };

  const startUpdate = async () => {
    if (!update) {
      return;
    }

    setIsDownloading(true);
    setErrorMessage(null);
    setProgress(null);

    try {
      await downloadAndInstallAppUpdate(update, setProgress);
    } catch {
      setErrorMessage('下载更新失败，请稍后重试。');
    } finally {
      setIsDownloading(false);
    }
  };

  const updateNotes = update?.notes ?? [];
  const canDismiss = !isDownloading && !update?.force;

  return (
    <>
      {children}
      <Portal>
        <Dialog
          visible={update !== null}
          dismissable={canDismiss}
          dismissableBackButton={canDismiss}
          onDismiss={dismissUpdate}>
          <Dialog.Title>发现新版本</Dialog.Title>
          <Dialog.Content>
            {update && <Text variant="bodyMedium">版本 {update.versionName}</Text>}
            {updateNotes.map((note) => (
              <Text key={note} variant="bodyMedium">
                {`· ${note}`}
              </Text>
            ))}
            {isDownloading && (
              <>
                <Text variant="bodyMedium">
                  {progress === null ? '正在下载更新…' : `正在下载：${Math.round(progress * 100)}%`}
                </Text>
                <ProgressBar
                  progress={progress ?? 0}
                  indeterminate={progress === null}
                />
              </>
            )}
            {errorMessage && <Text variant="bodyMedium">{errorMessage}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            {canDismiss && <Button onPress={dismissUpdate}>稍后</Button>}
            <Button disabled={isDownloading} onPress={startUpdate}>
              {isDownloading ? '下载中' : '立即更新'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
