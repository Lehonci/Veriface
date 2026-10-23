export type VerificationStatus =
  | 'PASSED'
  | 'SPOOF_FAILED'
  | 'VIRTUAL_CAM_BLOCKED'
  | 'POOR_LIGHTING';

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
  created_at: string;
  updated_at: string;
}

export interface VerificationSuccessPayload {
  success: boolean;
  zoomUrl: string;
  passcode?: string;
  meetingTitle: string;
  token: string;
  displayNameGuide: string;
  expiresIn: number;
}
