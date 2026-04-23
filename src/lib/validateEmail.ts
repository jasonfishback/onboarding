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
  format: boolean;     // passes regex
  hasMx: boolean;      // domain has mail servers
  disposable: boolean; // is on blocklist
  domain: string;
  issue?: string;      // short description if invalid
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

export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const trimmed = (email || "").trim().toLowerCase();
  const domain = trimmed.split("@")[1] || "";

  const result: EmailValidationResult = {
    valid: false,
    format: false,
    hasMx: false,
    disposable: false,
    domain,
  };

  // 1. Format check
  if (!isFormatValid(trimmed)) {
    result.issue = "Invalid format";
    return result;
  }
  result.format = true;

  // 2. Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    result.disposable = true;
    result.issue = "Disposable/throwaway email";
    return result;
  }

  // 3. DNS MX lookup — confirms domain can receive email
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
