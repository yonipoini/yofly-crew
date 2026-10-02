/**
 * ContentFilterService
 * 
 * Client-side pre-submission filtering for User Generated Content (UGC)
 * as required by Apple App Store Review Guideline 1.2 (Safety - User Generated Content).
 * Detects objectionable language, hate speech, harassment, severe profanity, and explicit terms.
 */

// Common high-severity prohibited words and phrases
const PROHIBITED_PATTERNS: RegExp[] = [
  // Hate speech & racial/ethnic slurs (with common obfuscations/leetspeak)
  /\bn[i1!l]gg[e3a4r]/i,
  /\bf[a4]gg?[o0]t/i,
  /\bk[i1]k[e3]/i,
  /\bch[i1]nk/i,
  /\bsp[i1]c\b/i,
  /\bw[e3]tb[a4]ck/i,
  /\br[e3]t[a4]rd/i,

  // Severe sexual profanity & explicit terms
  /\bc[u0]nt/i,
  /\bp[o0]rn/i,
  /\bwh[o0]r[e3]/i,
  /\bsl[u0]t/i,
  /\bb[l1]owj[o0]b/i,
  /\bd[i1]ck/i,
  /\bc[o0]ck\b/i,
  /\bp[u0]ssy/i,

  // Violence, threats & harassment
  /\bk[i1]ll\s+y[o0]urs[e3]lf/i,
  /\bgo\s+d[i1][e3]\b/i,
  /\bkys\b/i,
  /\br[a4]p[e3]/i,
  /\bass[a4]ss[i1]n/i,
  /\bb[o0]mb\s+thr[e3][a4]t/i,
  /\bsh[o0][o0]t\s+up/i,

  // General profanity (often used in abusive contexts)
  /\bf[u*x]ck/i,
  /\bm[o0]th[e3]rf[u*x]ck/i,
  /\bsh[i1!]t\b/i,
  /\bb[i1!]tch/i,
  /\b[a4]ssh[o0]l[e3]/i,
];

export interface ContentFilterResult {
  isClean: boolean;
  flaggedWord?: string;
  reason?: string;
}

class ContentFilterServiceClass {
  /**
   * Check text for any prohibited or objectionable content
   */
  checkContent(text: string): ContentFilterResult {
    if (!text || typeof text !== 'string') {
      return { isClean: true };
    }

    const normalized = text
      .toLowerCase()
      // Normalize common leetspeak characters
      .replace(/[@]/g, 'a')
      .replace(/[$]/g, 's')
      .replace(/[0]/g, 'o')
      .replace(/[1!]/g, 'i')
      .replace(/[3]/g, 'e');

    for (const pattern of PROHIBITED_PATTERNS) {
      const match = text.match(pattern) || normalized.match(pattern);
      if (match) {
        return {
          isClean: false,
          flaggedWord: match[0],
          reason: 'Your text contains prohibited or objectionable language that violates community safety standards.',
        };
      }
    }

    return { isClean: true };
  }

  /**
   * Validate post title and content together
   */
  validatePost(title: string, content: string): ContentFilterResult {
    const titleCheck = this.checkContent(title);
    if (!titleCheck.isClean) {
      return {
        isClean: false,
        flaggedWord: titleCheck.flaggedWord,
        reason: 'The post title contains prohibited or objectionable language.',
      };
    }

    const contentCheck = this.checkContent(content);
    if (!contentCheck.isClean) {
      return {
        isClean: false,
        flaggedWord: contentCheck.flaggedWord,
        reason: 'The post content contains prohibited or objectionable language.',
      };
    }

    return { isClean: true };
  }
}

export const ContentFilterService = new ContentFilterServiceClass();
