export type VerificationStatus =
  | 'PASSED'
  | 'SPOOF_FAILED'
  | 'VIRTUAL_CAM_BLOCKED'
  | 'POOR_LIGHTING';

export type AdminDecision = 'PENDING' | 'ADMITTED' | 'REMOVED' | 'AUTO_ADMITTED';

export type LivenessThresholdMode = 'balanced' | 'strict';

export interface ApplicantIdentity {
  fullName: string;
  email: string;
  jobPosition: string;
}

export interface VerificationMetrics {
  depthVariance: number;
  luminanceScore: number;
  confidenceScore: number;
  sampleCount: number;
  virtualCameraDetected: boolean;
  virtualCameraName?: string;
  failureReason?: string;
}

export interface VerificationRecord {
  id: string;
  full_name: string;
  email: string;
  job_position: string;
  jobPosition?: string;
  status: VerificationStatus;
  failure_reason: string | null;
  depth_variance: number | null;
  luminance_score: number | null;
  confidence_score: number | null;
  snapshot_url: string | null;
  zoom_snapshot_url?: string | null;
  zoom_captured_at?: string | null;
  admin_decision?: AdminDecision | null;
  decided_at?: string | null;
  review_requested?: boolean | null;
  ip_address: string | null;
  user_agent: string | null;
  jwt_token_jti: string | null;
  created_at: string;
}

export interface ZoomSetting {
  id: string;
  meeting_title: string;
  zoom_url: string;
  passcode: string;
  is_active: boolean;
  auto_redirect?: boolean;
  auto_admit_timeout?: number;
  admin_notify_email?: string | null;
  email_notification_enabled?: boolean;
  liveness_mode?: LivenessThresholdMode;
  created_at: string;
  updated_at: string;
}

export interface VerificationSuccessPayload {
  success: boolean;
  verificationId?: string;
  statusToken?: string;
  requiresApproval?: boolean;
  adminDecision?: AdminDecision;
  autoAdmitTimeout?: number;
  zoomUrl?: string;
  passcode?: string;
  meetingTitle?: string;
  token?: string;
  displayNameGuide: string;
  expiresIn?: number;
}
