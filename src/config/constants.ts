// ---------------------------------------------------------------------------
// API Error Codes (mirrored from ErrorCode enum for runtime usage)
// ---------------------------------------------------------------------------

/**
 * Plain-object map of error codes to HTTP status + default message pairs.
 * This is the authoritative runtime mapping used by the API gateway, error
 * middleware, and clients.
 */
export const ERROR_CODE_MAP = {
  // ---- Generic ----
  UNKNOWN_ERROR: {
    httpStatus: 500,
    message: 'An unknown error occurred',
  },
  VALIDATION_ERROR: {
    httpStatus: 400,
    message: 'Request validation failed',
  },
  INTERNAL_SERVER_ERROR: {
    httpStatus: 500,
    message: 'Internal server error',
  },

  // ---- Auth ----
  UNAUTHORIZED: {
    httpStatus: 401,
    message: 'Authentication is required',
  },
  FORBIDDEN: {
    httpStatus: 403,
    message: 'You do not have permission to perform this action',
  },
  INVALID_CREDENTIALS: {
    httpStatus: 401,
    message: 'Invalid email or password',
  },
  TOKEN_EXPIRED: {
    httpStatus: 401,
    message: 'Access token has expired',
  },
  TOKEN_INVALID: {
    httpStatus: 401,
    message: 'Access token is invalid',
  },
  REFRESH_TOKEN_EXPIRED: {
    httpStatus: 401,
    message: 'Refresh token has expired. Please sign in again.',
  },
  ACCOUNT_DISABLED: {
    httpStatus: 403,
    message: 'This account has been disabled',
  },
  ACCOUNT_NOT_FOUND: {
    httpStatus: 404,
    message: 'Account not found',
  },
  EMAIL_ALREADY_EXISTS: {
    httpStatus: 409,
    message: 'An account with this email already exists',
  },
  PHONE_ALREADY_EXISTS: {
    httpStatus: 409,
    message: 'An account with this phone number already exists',
  },
  OTP_EXPIRED: {
    httpStatus: 400,
    message: 'Verification code has expired',
  },
  OTP_INVALID: {
    httpStatus: 400,
    message: 'Invalid verification code',
  },
  OTP_RATE_LIMITED: {
    httpStatus: 429,
    message: 'Too many OTP requests. Please try again later.',
  },
  SOCIAL_AUTH_FAILED: {
    httpStatus: 401,
    message: 'Social authentication failed',
  },
  PASSWORD_TOO_WEAK: {
    httpStatus: 400,
    message: 'Password does not meet minimum requirements',
  },

  // ---- Resource ----
  NOT_FOUND: {
    httpStatus: 404,
    message: 'The requested resource was not found',
  },
  CONFLICT: {
    httpStatus: 409,
    message: 'A conflict occurred with the current state',
  },
  GONE: {
    httpStatus: 410,
    message: 'The requested resource is no longer available',
  },

  // ---- Rate Limiting ----
  RATE_LIMITED: {
    httpStatus: 429,
    message: 'Too many requests. Please try again later.',
  },

  // ---- Subscription ----
  SUBSCRIPTION_REQUIRED: {
    httpStatus: 403,
    message: 'A paid subscription is required to access this feature',
  },
  SUBSCRIPTION_EXPIRED: {
    httpStatus: 403,
    message: 'Your subscription has expired',
  },
  SUBSCRIPTION_ALREADY_ACTIVE: {
    httpStatus: 409,
    message: 'You already have an active subscription',
  },
  RECEIPT_INVALID: {
    httpStatus: 400,
    message: 'The purchase receipt is invalid',
  },
  RECEIPT_ALREADY_USED: {
    httpStatus: 409,
    message: 'This receipt has already been used',
  },

  // ---- AI ----
  AI_LIMIT_REACHED: {
    httpStatus: 429,
    message: 'You have reached your daily AI enhancement limit',
  },
  AI_PROCESSING_FAILED: {
    httpStatus: 500,
    message: 'AI processing failed. Please try again.',
  },
  AI_MODEL_UNAVAILABLE: {
    httpStatus: 503,
    message: 'AI model is temporarily unavailable',
  },

  // ---- Storage ----
  STORAGE_FULL: {
    httpStatus: 507,
    message: 'Your cloud storage is full',
  },
  FILE_TOO_LARGE: {
    httpStatus: 413,
    message: 'The file exceeds the maximum allowed size',
  },
  INVALID_FILE_TYPE: {
    httpStatus: 400,
    message: 'The file type is not supported',
  },
  UPLOAD_FAILED: {
    httpStatus: 500,
    message: 'File upload failed',
  },
  UPLOAD_EXPIRED: {
    httpStatus: 410,
    message: 'The upload URL has expired',
  },

  // ---- Media ----
  MEDIA_NOT_FOUND: {
    httpStatus: 404,
    message: 'Media not found',
  },
  MEDIA_PROCESSING: {
    httpStatus: 202,
    message: 'Media is still being processed',
  },
  ALBUM_LIMIT_REACHED: {
    httpStatus: 403,
    message: 'You have reached the maximum number of albums for your plan',
  },

  // ---- Content ----
  CONTENT_NOT_FOUND: {
    httpStatus: 404,
    message: 'Content not found',
  },
  CONTENT_NOT_AVAILABLE: {
    httpStatus: 403,
    message: 'This content is not available for your subscription tier',
  },

  // ---- Feature Flags ----
  FLAG_NOT_FOUND: {
    httpStatus: 404,
    message: 'Feature flag not found',
  },

  // ---- Support ----
  TICKET_CLOSED: {
    httpStatus: 400,
    message: 'This support ticket has been closed and cannot receive replies',
  },
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODE_MAP;

// ---------------------------------------------------------------------------
// Subscription Tier Limits & Feature Entitlements
// ---------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'premium' | 'pro' | 'enterprise';

export interface TierLimits {
  aiDailyLimit: number; // 0 = unlimited
  maxPhotoResolution: number; // pixels (longest edge)
  maxVideoResolution: number; // pixels (height for 16:9)
  maxVideoMinutes: number; // 0 = unlimited
  maxAlbums: number; // 0 = unlimited
  cloudStorageGb: number; // 0 = none
  beautyFilters: number; // count
  photoFilters: number; // count
  hasWatermark: boolean;
  hasAds: boolean;
  canBatchEdit: boolean;
  canExportRaw: boolean;
  canRemoveBackground: boolean;
  canUseAdvancedEditor: boolean;
  canUseCustomPresets: boolean;
  canAccessApi: boolean;
  canUseSso: boolean;
  hasTeamManagement: boolean;
  hasPriorityProcessing: boolean;
  hasDedicatedSupport: boolean;
  features: readonly string[];
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    aiDailyLimit: 3,
    maxPhotoResolution: 1080,
    maxVideoResolution: 720,
    maxVideoMinutes: 30,
    maxAlbums: 5,
    cloudStorageGb: 0,
    beautyFilters: 5,
    photoFilters: 10,
    hasWatermark: true,
    hasAds: true,
    canBatchEdit: false,
    canExportRaw: false,
    canRemoveBackground: false,
    canUseAdvancedEditor: false,
    canUseCustomPresets: false,
    canAccessApi: false,
    canUseSso: false,
    hasTeamManagement: false,
    hasPriorityProcessing: false,
    hasDedicatedSupport: false,
    features: [
      'basic_skin_smoothing',
      'basic_filters',
      'basic_crop',
      'basic_adjust',
      'photo_capture',
      'video_capture',
    ],
  },
  premium: {
    aiDailyLimit: 0, // unlimited
    maxPhotoResolution: 3840, // 4K
    maxVideoResolution: 1080,
    maxVideoMinutes: 120,
    maxAlbums: 0, // unlimited
    cloudStorageGb: 5,
    beautyFilters: 30,
    photoFilters: 50,
    hasWatermark: false,
    hasAds: false,
    canBatchEdit: false,
    canExportRaw: false,
    canRemoveBackground: false,
    canUseAdvancedEditor: false,
    canUseCustomPresets: false,
    canAccessApi: false,
    canUseSso: false,
    hasTeamManagement: false,
    hasPriorityProcessing: true,
    hasDedicatedSupport: false,
    features: [
      'basic_skin_smoothing',
      'advanced_skin_smoothing',
      'basic_filters',
      'premium_filters',
      'basic_crop',
      'basic_adjust',
      'advanced_adjust',
      'photo_capture',
      'video_capture',
      'face_reshape',
      'eye_enlarge',
      'nose_slim',
      'teeth_whiten',
      'makeup_blush',
      'makeup_contour',
      'makeup_lipstick',
      'cloud_backup',
      'no_watermark',
      'no_ads',
    ],
  },
  pro: {
    aiDailyLimit: 0, // unlimited
    maxPhotoResolution: 3840, // 4K
    maxVideoResolution: 2160, // 4K
    maxVideoMinutes: 0, // unlimited
    maxAlbums: 0, // unlimited
    cloudStorageGb: 50,
    beautyFilters: 100,
    photoFilters: 100,
    hasWatermark: false,
    hasAds: false,
    canBatchEdit: true,
    canExportRaw: true,
    canRemoveBackground: true,
    canUseAdvancedEditor: true,
    canUseCustomPresets: true,
    canAccessApi: false,
    canUseSso: false,
    hasTeamManagement: false,
    hasPriorityProcessing: true,
    hasDedicatedSupport: false,
    features: [
      'basic_skin_smoothing',
      'advanced_skin_smoothing',
      'basic_filters',
      'premium_filters',
      'pro_filters',
      'basic_crop',
      'basic_adjust',
      'advanced_adjust',
      'photo_capture',
      'video_capture',
      'face_reshape',
      'eye_enlarge',
      'nose_slim',
      'teeth_whiten',
      'makeup_blush',
      'makeup_contour',
      'makeup_lipstick',
      'makeup_eyeshadow',
      'makeup_highlight',
      'cloud_backup',
      'no_watermark',
      'no_ads',
      'batch_edit',
      'raw_export',
      'background_remover',
      'object_eraser',
      'advanced_editor',
      'custom_presets',
      'color_grading',
      'video_4k',
      'lut_import',
    ],
  },
  enterprise: {
    aiDailyLimit: 0, // unlimited
    maxPhotoResolution: 3840,
    maxVideoResolution: 2160,
    maxVideoMinutes: 0, // unlimited
    maxAlbums: 0, // unlimited
    cloudStorageGb: 200, // per seat
    beautyFilters: 100,
    photoFilters: 100,
    hasWatermark: false,
    hasAds: false,
    canBatchEdit: true,
    canExportRaw: true,
    canRemoveBackground: true,
    canUseAdvancedEditor: true,
    canUseCustomPresets: true,
    canAccessApi: true,
    canUseSso: true,
    hasTeamManagement: true,
    hasPriorityProcessing: true,
    hasDedicatedSupport: true,
    features: [
      'basic_skin_smoothing',
      'advanced_skin_smoothing',
      'basic_filters',
      'premium_filters',
      'pro_filters',
      'basic_crop',
      'basic_adjust',
      'advanced_adjust',
      'photo_capture',
      'video_capture',
      'face_reshape',
      'eye_enlarge',
      'nose_slim',
      'teeth_whiten',
      'makeup_blush',
      'makeup_contour',
      'makeup_lipstick',
      'makeup_eyeshadow',
      'makeup_highlight',
      'cloud_backup',
      'no_watermark',
      'no_ads',
      'batch_edit',
      'raw_export',
      'background_remover',
      'object_eraser',
      'advanced_editor',
      'custom_presets',
      'color_grading',
      'video_4k',
      'lut_import',
      'team_management',
      'brand_kit',
      'api_access',
      'sso',
      'dedicated_support',
      'sla_guarantee',
      'custom_integrations',
      'analytics_dashboard',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Rate Limit Presets
// ---------------------------------------------------------------------------

export const RATE_LIMIT_PRESETS = {
  auth: { max: 5, window: 60 },
  api: { max: 100, window: 60 },
  upload: { max: 10, window: 60 },
  ai: { max: 5, window: 60 },
  analytics: { max: 1000, window: 60 },
} as const;
