import { ExtractionResult } from "../types/resume.js";

/**
 * Extract contact information from resume text using enhanced regex patterns
 */
export function extractResumeInfo(text: string): ExtractionResult {
  // Enhanced email regex pattern (more comprehensive)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = text.match(emailRegex);
  
  // Enhanced phone number regex pattern
  // Matches various international formats:
  // - (123) 456-7890
  // - 123-456-7890
  // - 123.456.7890
  // - +1 123 456 7890
  // - +44 20 1234 5678
  // - +91 98765 43210
  // - (555)555-5555
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g;
  const phoneMatches = text.match(phoneRegex);
  
  // Get the first valid-looking phone number (at least 10 digits)
  let phoneNumber: string | null = null;
  if (phoneMatches) {
    for (const match of phoneMatches) {
      const digitsOnly = match.replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        phoneNumber = match.trim();
        break;
      }
    }
  }
  
  return {
    email: emailMatch ? emailMatch[0] : null,
    phoneNumber,
    fullContent: text.trim()
  };
}

/**
 * Validate extracted metadata
 */
export function validateResumeMetadata(data: ExtractionResult): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!data.email) {
    warnings.push("No email address found");
  } else if (!isValidEmail(data.email)) {
    warnings.push(`Email format may be invalid: ${data.email}`);
  }

  if (!data.phoneNumber) {
    warnings.push("No phone number found");
  } else if (!isValidPhone(data.phoneNumber)) {
    warnings.push(`Phone number format may be invalid: ${data.phoneNumber}`);
  }

  if (!data.fullContent || data.fullContent.length < 100) {
    warnings.push("Resume content is too short (< 100 characters)");
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (at least 10 digits)
 */
function isValidPhone(phone: string): boolean {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}
