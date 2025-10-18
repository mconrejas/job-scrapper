import { PrismaClient } from '@prisma/client';
import type { JobResult } from '../ollama/job-searcher';
import type { MatchedJob } from '../matching/ranker';

const prisma = new PrismaClient();

/**
 * Job Storage
 * Stores jobs and job matches in the database
 */

export class JobStorage {
  /**
   * Store a job in the database
   * Returns the job ID
   */
  static async storeJob(job: JobResult): Promise<string> {
    // Check if job already exists
    const existing = await prisma.job.findUnique({
      where: {
        platform_externalId: {
          platform: job.platform,
          externalId: job.url, // Using URL as external ID since we don't have real IDs
        },
      },
    });

    if (existing) {
      return existing.id;
    }

    // Create new job
    const created = await prisma.job.create({
      data: {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        salary: job.salary,
        platform: job.platform,
        externalId: job.url, // Using URL as unique identifier
        externalUrl: job.url,
        postedDate: job.postedDate ? new Date(job.postedDate) : null,
        skills: job.skills || [],
        requirements: job.description, // Using description as requirements
        rawData: job,
      },
    });

    return created.id;
  }

  /**
   * Store multiple jobs
   * Returns array of job IDs
   */
  static async storeJobs(jobs: JobResult[]): Promise<string[]> {
    const jobIds: string[] = [];

    for (const job of jobs) {
      try {
        const jobId = await this.storeJob(job);
        jobIds.push(jobId);
      } catch (error) {
        console.error(`Failed to store job: ${job.title}`, error);
      }
    }

    return jobIds;
  }

  /**
   * Store a job match in the database
   */
  static async storeJobMatch(
    userId: string,
    jobId: string,
    match: MatchedJob
  ): Promise<string> {
    // Check if match already exists
    const existing = await prisma.jobMatch.findUnique({
      where: {
        userId_jobId: {
          userId,
          jobId,
        },
      },
    });

    if (existing) {
      // Update existing match
      const updated = await prisma.jobMatch.update({
        where: { id: existing.id },
        data: {
          overallScore: match.scores.overall * 100,
          skillMatchScore: match.scores.skillMatch * 100,
          experienceScore: match.scores.experienceMatch * 100,
          topApplicantScore: match.scores.topApplicant * 100,
          matchReason: match.reason,
          matchDetails: {
            matchedSkills: match.matchedSkills,
            missingSkills: match.missingSkills,
            scores: match.scores,
          },
          updatedAt: new Date(),
        },
      });
      return updated.id;
    }

    // Create new match
    const created = await prisma.jobMatch.create({
      data: {
        userId,
        jobId,
        overallScore: match.scores.overall * 100,
        skillMatchScore: match.scores.skillMatch * 100,
        experienceScore: match.scores.experienceMatch * 100,
        locationScore: 50, // Default location score
        topApplicantScore: match.scores.topApplicant * 100,
        matchReason: match.reason,
        matchDetails: {
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          scores: match.scores,
        },
      },
    });

    return created.id;
  }

  /**
   * Store multiple job matches
   * Returns array of match IDs
   */
  static async storeJobMatches(
    userId: string,
    matches: Array<{ jobId: string; match: MatchedJob }>
  ): Promise<string[]> {
    const matchIds: string[] = [];

    for (const { jobId, match } of matches) {
      try {
        const matchId = await this.storeJobMatch(userId, jobId, match);
        matchIds.push(matchId);
      } catch (error) {
        console.error(`Failed to store job match for job ${jobId}`, error);
      }
    }

    return matchIds;
  }

  /**
   * Get user's top job matches
   */
  static async getTopMatches(userId: string, limit: number = 10) {
    return prisma.jobMatch.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { overallScore: 'desc' },
      take: limit,
    });
  }
}
