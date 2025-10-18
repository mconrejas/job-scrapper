import type { ExtractedResumeData } from '../resume/parser';
import type { JobResult } from '../ollama/job-searcher';

/**
 * Job Matcher and Ranker
 * Analyzes jobs against resume data to find best matches
 */

export interface MatchedJob {
  job: JobResult;
  scores: {
    overall: number;          // 0-1 overall match score
    skillMatch: number;       // 0-1 skill overlap
    titleMatch: number;       // 0-1 job title relevance
    experienceMatch: number;  // 0-1 experience relevance
    topApplicant: number;     // 0-1 likelihood of being top applicant
  };
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
}

export class JobRanker {
  /**
   * Match and rank jobs based on resume data
   */
  static matchAndRank(
    resumeData: ExtractedResumeData,
    jobs: JobResult[],
    onProgress?: (status: string) => void
  ): MatchedJob[] {
    const matched: MatchedJob[] = [];

    for (const job of jobs) {
      const match = this.analyzeMatch(resumeData, job);
      matched.push(match);
    }

    // Sort by overall score (best matches first)
    matched.sort((a, b) => b.scores.overall - a.scores.overall);

    return matched;
  }

  /**
   * Analyze how well a job matches the resume
   */
  private static analyzeMatch(
    resumeData: ExtractedResumeData,
    job: JobResult
  ): MatchedJob {
    // Calculate individual scores
    const skillMatch = this.calculateSkillMatch(resumeData.skills, job);
    const titleMatch = this.calculateTitleMatch(resumeData.jobTitles, job);
    const experienceMatch = this.calculateExperienceMatch(resumeData, job);

    // Calculate overall score (weighted average)
    const overall = (
      skillMatch * 0.4 +
      titleMatch * 0.3 +
      experienceMatch * 0.3
    );

    // Calculate top applicant score (based on overall + extra factors)
    const topApplicant = this.calculateTopApplicantScore(
      overall,
      skillMatch,
      titleMatch,
      job
    );

    // Find matched and missing skills
    const { matched: matchedSkills, missing: missingSkills } = this.analyzeSkills(
      resumeData.skills,
      job
    );

    // Generate match reason
    const reason = this.generateMatchReason(
      matchedSkills,
      missingSkills,
      titleMatch,
      overall
    );

    return {
      job,
      scores: {
        overall,
        skillMatch,
        titleMatch,
        experienceMatch,
        topApplicant,
      },
      matchedSkills,
      missingSkills,
      reason,
    };
  }

  /**
   * Calculate skill match score
   */
  private static calculateSkillMatch(resumeSkills: string[], job: JobResult): number {
    if (resumeSkills.length === 0) return 0;

    const jobText = `${job.title} ${job.description}`.toLowerCase();
    let matchCount = 0;

    for (const skill of resumeSkills) {
      if (jobText.includes(skill.toLowerCase())) {
        matchCount++;
      }
    }

    return matchCount / resumeSkills.length;
  }

  /**
   * Calculate title match score
   */
  private static calculateTitleMatch(jobTitles: string[], job: JobResult): number {
    if (jobTitles.length === 0) return 0.5; // Default if no titles

    const jobTitle = job.title.toLowerCase();
    let bestMatch = 0;

    for (const title of jobTitles) {
      const titleLower = title.toLowerCase();
      const words = titleLower.split(/\s+/);

      // Check if any words from resume title appear in job title
      let wordMatches = 0;
      for (const word of words) {
        if (jobTitle.includes(word)) {
          wordMatches++;
        }
      }

      const matchScore = wordMatches / words.length;
      bestMatch = Math.max(bestMatch, matchScore);
    }

    return bestMatch;
  }

  /**
   * Calculate experience match score
   */
  private static calculateExperienceMatch(resumeData: ExtractedResumeData, job: JobResult): number {
    const jobText = job.description.toLowerCase();

    // Check for seniority level
    const resumeHasSenior = resumeData.experiences.some(exp =>
      exp.title.toLowerCase().includes('senior') ||
      exp.title.toLowerCase().includes('lead') ||
      exp.title.toLowerCase().includes('principal')
    );

    const jobRequiresSenior =
      jobText.includes('senior') ||
      jobText.includes('lead') ||
      jobText.includes('principal') ||
      jobText.includes('5+ years') ||
      jobText.includes('5 years');

    const jobRequiresJunior =
      jobText.includes('junior') ||
      jobText.includes('entry') ||
      jobText.includes('0-2 years');

    // Score based on level match
    if (resumeHasSenior && jobRequiresSenior) {
      return 1.0; // Perfect match
    } else if (!resumeHasSenior && jobRequiresJunior) {
      return 1.0; // Perfect match
    } else if (resumeHasSenior && jobRequiresJunior) {
      return 0.8; // Overqualified
    } else if (!resumeHasSenior && jobRequiresSenior) {
      return 0.5; // May be stretch
    }

    return 0.7; // Default - reasonable match
  }

  /**
   * Calculate top applicant score
   */
  private static calculateTopApplicantScore(
    overall: number,
    skillMatch: number,
    titleMatch: number,
    job: JobResult
  ): number {
    // Base score from overall match
    let score = overall;

    // Bonus for high skill match
    if (skillMatch > 0.7) {
      score += 0.1;
    }

    // Bonus for exact title match
    if (titleMatch > 0.8) {
      score += 0.1;
    }

    // Bonus for remote jobs (easier to be top applicant)
    if (job.location.toLowerCase().includes('remote')) {
      score += 0.05;
    }

    // Penalty if job is very recent (more competition)
    const daysSincePosted = job.postedDate
      ? (Date.now() - new Date(job.postedDate).getTime()) / (1000 * 60 * 60 * 24)
      : 30;

    if (daysSincePosted < 1) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Analyze which skills are matched and missing
   */
  private static analyzeSkills(resumeSkills: string[], job: JobResult): {
    matched: string[];
    missing: string[];
  } {
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];

    // Get job skills if available
    const jobSkills = job.skills || [];

    for (const skill of resumeSkills) {
      if (jobText.includes(skill.toLowerCase())) {
        matched.push(skill);
      }
    }

    // Find skills mentioned in job but not in resume
    for (const skill of jobSkills) {
      const skillLower = skill.toLowerCase();
      const hasSkill = resumeSkills.some(rs => rs.toLowerCase() === skillLower);

      if (!hasSkill && !missing.includes(skill)) {
        missing.push(skill);
      }
    }

    return { matched, missing: missing.slice(0, 5) }; // Limit missing to top 5
  }

  /**
   * Generate human-readable match reason
   */
  private static generateMatchReason(
    matchedSkills: string[],
    missingSkills: string[],
    titleMatch: number,
    overall: number
  ): string {
    if (overall >= 0.8) {
      return `Excellent match! ${matchedSkills.length} matching skills including ${matchedSkills.slice(0, 3).join(', ')}. You're a strong candidate for this role.`;
    } else if (overall >= 0.6) {
      return `Good match. Your skills in ${matchedSkills.slice(0, 3).join(', ')} align well. ${missingSkills.length > 0 ? `Consider highlighting experience with ${missingSkills.slice(0, 2).join(', ')}.` : ''}`;
    } else if (overall >= 0.4) {
      return `Moderate match. You have relevant skills but this role requires ${missingSkills.slice(0, 2).join(', ')} which aren't prominent in your resume.`;
    } else {
      return `Lower match. This role emphasizes skills like ${missingSkills.slice(0, 3).join(', ')} which may be outside your primary expertise.`;
    }
  }

  /**
   * Filter to top matches only
   */
  static getTopMatches(matches: MatchedJob[], topN: number = 10): MatchedJob[] {
    return matches
      .filter(m => m.scores.overall >= 0.4) // Only include reasonable matches
      .slice(0, topN);
  }
}
