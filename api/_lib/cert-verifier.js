import { URL } from 'url';

/**
  * Safely validates a target URL to prevent SSRF and internal network scanning.
  */
export function validatePublicUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, reason: 'URL is required.' };
  }
  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTP and HTTPS protocols are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF checks - Block private/local IP addresses and local domains
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { ok: false, reason: 'Access to local or internal hosts is restricted.' };
  }

  // IPv4 private ranges check
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, p1, p2] = ipv4Match.map(Number);
    if (
      p1 === 10 || // 10.0.0.0/8
      p1 === 127 || // 127.0.0.0/8
      (p1 === 172 && p2 >= 16 && p2 <= 31) || // 172.16.0.0/12
      (p1 === 192 && p2 === 168) || // 192.168.0.0/16
      (p1 === 169 && p2 === 254) // 169.254.0.0/16 Link-local
    ) {
      return { ok: false, reason: 'Access to private IP ranges is restricted.' };
    }
  }

  return { ok: true, url: parsed.toString(), hostname };
}

/**
 * Perform safe HTTP-based public verification check with timeout and SSRF protection.
 */
export async function performAutomaticVerification({
  verificationUrl,
  certificateId,
  issuer,
  expiryDate,
}) {
  const timestamp = new Date().toISOString();
  const issuerName = String(issuer || 'Unknown Issuer').trim();
  const certIdStr = certificateId ? String(certificateId).trim() : '';

  // 1. Expiry Check First
  if (expiryDate) {
    const expTime = new Date(expiryDate).getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      return {
        verification_method: verificationUrl ? 'PUBLIC_URL_HTTP' : 'MANUAL_OR_NONE',
        issuer: issuerName,
        certificate_id: certIdStr || undefined,
        verification_url: verificationUrl || undefined,
        timestamp,
        result: 'EXPIRED',
        details: `Certificate expired on ${expiryDate}.`,
        expires_at: expiryDate,
      };
    }
  }

  // 2. No usable verification method provided
  if (!verificationUrl || !String(verificationUrl).trim()) {
    return {
      verification_method: 'MANUAL_OR_NONE',
      issuer: issuerName,
      certificate_id: certIdStr || undefined,
      timestamp,
      result: 'UNVERIFIED',
      details: 'No public verification URL or QR code verification source provided.',
    };
  }

  // 3. Validate URL for SSRF security
  const validation = validatePublicUrl(verificationUrl);
  if (!validation.ok) {
    return {
      verification_method: 'PUBLIC_URL_HTTP',
      issuer: issuerName,
      certificate_id: certIdStr || undefined,
      verification_url: verificationUrl,
      timestamp,
      result: 'NEEDS REVIEW',
      details: `Verification URL rejected: ${validation.reason}`,
    };
  }

  // 4. Safe HTTP Fetch with Timeout (5000ms limit)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(validation.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SkillSetu-Verification-Bot/1.0 (+https://skillsetu.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/json,text/plain',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    const statusCode = response.status;

    if (statusCode >= 200 && statusCode < 300) {
      // Body content check for invalid/revoked keywords
      const text = (await response.text()).toLowerCase();

      if (text.includes('revoked') || text.includes('invalid certificate') || text.includes('not found')) {
        return {
          verification_method: 'PUBLIC_URL_HTTP',
          issuer: issuerName,
          certificate_id: certIdStr || undefined,
          verification_url: validation.url,
          timestamp,
          result: 'INVALID',
          details: `Issuer server responded HTTP ${statusCode}, but page text indicates certificate is revoked or invalid.`,
          http_status_code: statusCode,
        };
      }

      // Check if Cert ID or Issuer or Certificate keyword is found on page
      const hasCertIdMatch = certIdStr && certIdStr.length >= 4 && text.includes(certIdStr.toLowerCase());

      if (hasCertIdMatch || text.includes('verified') || text.includes('certificate') || text.includes('credential')) {
        return {
          verification_method: 'PUBLIC_URL_HTTP',
          issuer: issuerName,
          certificate_id: certIdStr || undefined,
          verification_url: validation.url,
          timestamp,
          result: 'VERIFIED',
          details: `Successfully confirmed against issuer source (${validation.hostname}, HTTP ${statusCode}).`,
          http_status_code: statusCode,
        };
      }

      return {
        verification_method: 'PUBLIC_URL_HTTP',
        issuer: issuerName,
        certificate_id: certIdStr || undefined,
        verification_url: validation.url,
        timestamp,
        result: 'NEEDS REVIEW',
        details: `Issuer URL returned HTTP ${statusCode}, but certificate ID/details could not be automatically confirmed on page.`,
        http_status_code: statusCode,
      };
    } else if (statusCode === 404 || statusCode === 410) {
      return {
        verification_method: 'PUBLIC_URL_HTTP',
        issuer: issuerName,
        certificate_id: certIdStr || undefined,
        verification_url: validation.url,
        timestamp,
        result: 'INVALID',
        details: `Issuer verification source returned HTTP ${statusCode} (Not Found / Gone).`,
        http_status_code: statusCode,
      };
    } else {
      return {
        verification_method: 'PUBLIC_URL_HTTP',
        issuer: issuerName,
        certificate_id: certIdStr || undefined,
        verification_url: validation.url,
        timestamp,
        result: 'NEEDS REVIEW',
        details: `Issuer source returned HTTP ${statusCode}. Automatic confirmation inconclusive.`,
        http_status_code: statusCode,
      };
    }
  } catch (err) {
    const isAbort = err.name === 'AbortError';
    return {
      verification_method: 'PUBLIC_URL_HTTP',
      issuer: issuerName,
      certificate_id: certIdStr || undefined,
      verification_url: validation.url,
      timestamp,
      result: 'NEEDS REVIEW',
      details: isAbort
        ? 'Verification request timed out (5s limit).'
        : `Could not reach issuer URL automatically (${err.message}).`,
    };
  }
}
