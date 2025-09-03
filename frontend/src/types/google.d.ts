declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleOneTapConfig) => void
          prompt: (callback?: (notification: GoogleOneTapNotification) => void) => void
          cancel: () => void
          disableAutoSelect: () => void
          revoke: (hint: string, callback: (response: any) => void) => void
        }
      }
    }
  }
}

interface GoogleOneTapConfig {
  client_id: string
  callback: (response: GoogleOneTapCredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: string
  state_cookie_domain?: string
  ux_mode?: string
  login_uri?: string
  native_login_uri?: string
  intermediate_iframe_close_callback?: () => void
  itp_support?: boolean
  use_fedcm_for_prompt?: boolean
}

interface GoogleOneTapCredentialResponse {
  credential: string
  select_by: string
}

interface GoogleOneTapNotification {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
  getMomentType: () => string
}

export {GoogleOneTapCredentialResponse, GoogleOneTapNotification}