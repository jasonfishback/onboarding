import { promises as dns } from "dns";

// Common disposable email domains — regularly updated sources:
// https://github.com/disposable-email-domains/disposable-email-domains
// We include the most prolific throwaway services that show up in fraud/abuse cases.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "mailinator.net", "mailinator.org",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.biz", "guerrillamail.de", "guerrillamailblock.com", "sharklasers.com",
  "grr.la", "yopmail.com", "yopmail.net", "yopmail.fr",
  "temp-mail.org", "temp-mail.ru", "tempmail.com", "tempmail.net", "tempmailo.com",
  "10minutemail.com", "10minutemail.net", "10minutemail.co.uk",
  "throwawaymail.com", "trashmail.com", "trashmail.net", "trashmail.de",
  "tempmailaddress.com", "dispostable.com", "getnada.com", "nada.email",
  "maildrop.cc", "mintemail.com", "mailcatch.com", "inboxbear.com",
  "fakeinbox.com", "fakemail.net", "mail-temporaire.fr",
  "emailondeck.com", "moakt.com", "tempemail.net", "tempmailer.com",
  "20minutemail.com", "30minutemail.com", "60minutemail.com",
  "mail.tm", "burnermail.io", "mytemp.email", "tmail.ws",
  "mohmal.com", "spambox.us", "spam4.me", "spamgourmet.com",
  "deadaddress.com", "anonymbox.com", "mailexpire.com",
  "spoofmail.de", "einrot.com", "emlpro.com",
]);

export interface EmailValidationResult {
  valid: boolean;
  format: boolean;      // passes regex
  hasMx: boolean;       // domain has mail servers
  disposable: boolean;  // is on blocklist / Abstract flags as disposable
  freeProvider?: boolean; // Gmail, Yahoo, etc. (info only, not a failure)
  deliverable?: string;  // Abstract's deliverability: DELIVERABLE / UNDELIVERABLE / UNKNOWN / RISKY
  qualityScore?: number; // Abstract's 0-1 score
  domain: string;
  issue?: string;        // short description if invalid
  source: "abstract" | "local";
}

// Regex check — RFC 5322-ish, practical subset
function isFormatValid(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || local.length > 64) return false;
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  return true;
}

// Local validation: format + disposable blocklist + DNS MX
async function validateEmailLocal(email: string): Promise<EmailValidationResult> {
  const trimmed = (email || "").trim().toLowerCase();
  const domain = trimmed.split("@")[1] || "";

  const result: EmailValidationResult = {
    valid: false,
    format: false,
    hasMx: false,
    disposable: false,
    domain,
    source: "local",
  };

  if (!isFormatValid(trimmed)) {
    result.issue = "Invalid format";
    return result;
  }
  result.format = true;

  if (DISPOSABLE_DOMAINS.has(domain)) {
    result.disposable = true;
    result.issue = "Disposable/throwaway email";
    return result;
  }

  try {
    const records = await dns.resolveMx(domain);
    if (records && records.length > 0) {
      result.hasMx = true;
    } else {
      result.issue = "Domain has no mail servers";
      return result;
    }
  } catch {
    result.issue = "Domain does not exist or has no mail servers";
    return result;
  }

  result.valid = true;
  return result;
}

// AbstractAPI shape — only the fields we care about
interface AbstractResponse {
  email?: string;
  is_valid_format?: { value: boolean };
  is_mx_found?: { value: boolean };
  is_smtp_valid?: { value: boolean };
  is_catchall_email?: { value: boolean };
  is_disposable_email?: { value: boolean };
  is_free_email?: { value: boolean };
  quality_score?: string | number;
  deliverability?: string;
}

// Primary: AbstractAPI. Falls back to local if unavailable/times out/error.
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const trimmed = (email || "").trim().toLowerCase();
  const domain = trimmed.split("@")[1] || "";

  // Quick format pre-check (saves an API call for obviously invalid input)
  if (!isFormatValid(trimmed)) {
    return {
      valid: false,
      format: false,
      hasMx: false,
      disposable: false,
      domain,
      issue: "Invalid format",
      source: "local",
    };
  }

  const abstractKey = process.env.ABSTRACT_EMAIL_API_KEY;
  if (abstractKey) {
    try {
      const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${abstractKey}&email=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as AbstractResponse;
        // Abstract responds with 200 even on quota-exceeded — detect by missing fields
        if (data && data.is_valid_format) {
          const format = !!data.is_valid_format?.value;
          const hasMx = !!data.is_mx_found?.value;
          const disposable = !!data.is_disposable_email?.value;
          const smtpValid = !!data.is_smtp_valid?.value;
          const deliverability = data.deliverability || "";
          const qualityScore = typeof data.quality_score === "string" ? parseFloat(data.quality_score) : (data.quality_score ?? undefined);

          const result: EmailValidationResult = {
            valid: format && hasMx && !disposable && smtpValid,
            format,
            hasMx,
            disposable,
            freeProvider: !!data.is_free_email?.value,
            deliverability,
            qualityScore,
            domain,
            source: "abstract",
          };

          if (!format) result.issue = "Invalid format";
          else if (disposable) result.issue = "Disposable/throwaway email";
          else if (!hasMx) result.issue = "Domain has no mail servers";
          else if (!smtpValid) result.issue = "Mailbox may not exist";
          else if (deliverability === "UNDELIVERABLE") result.issue = "Email undeliverable";
          else if (deliverability === "RISKY") result.issue = "Risky — likely bounces";

          return result;
        }
      }
      // 402/403/etc — quota exceeded or auth failure — fall through to local
    } catch {
      // Timeout or network error — fall through to local
    }
  }

  // Fallback
  return validateEmailLocal(trimmed);
}
