export interface SessionCapabilities {
  managePlatform: boolean;
}

export const sessionCapabilities: SessionCapabilities = {
  // The backend must supply this capability from the authenticated session.
  managePlatform: import.meta.env.VITE_PREVIEW_GLOBAL_ADMIN === 'true',
};
