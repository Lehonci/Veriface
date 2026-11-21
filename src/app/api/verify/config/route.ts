import { NextResponse } from 'next/server';
import { getActiveZoomConfig } from '@/lib/zoomHelpers';
import { getServerModelPolicy, resolveActiveThreshold } from '@/lib/verifyChallenge';

export const dynamic = 'force-dynamic';

/**
 * Endpoint publik read-only yang hanya mengekspos kebijakan ambang batas AI non-sensitif.
 * Tidak pernah mengembalikan URL Zoom, passcode, atau email administrator.
 */
export async function GET() {
  const activeZoom = await getActiveZoomConfig();
  const policy = getServerModelPolicy();
  const activeThreshold = resolveActiveThreshold(activeZoom.liveness_mode);

  return NextResponse.json(
    {
      success: true,
      livenessMode: activeZoom.liveness_mode,
      activeThreshold,
      strictThreshold: policy.strictThreshold,
      balancedThreshold: policy.balancedThreshold,
      minMeanLuma: policy.minMeanLuma,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
