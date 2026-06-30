type AppSyncEvent = 'community' | 'marketplace' | 'profile';

type AppSyncListener = (event: AppSyncEvent) => void;

const listeners = new Set<AppSyncListener>();

export const AppSyncService = {
  emit(event: AppSyncEvent) {
    listeners.forEach((listener) => {
      listener(event);
    });
  },

  subscribe(listener: AppSyncListener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};
