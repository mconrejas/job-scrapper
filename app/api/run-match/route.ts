import { NextResponse } from 'next/server';
import { ResumeParser } from '@/lib/resume/parser';
import { ResumeStorage } from '@/lib/resume/storage';
import { OllamaJobSearcher } from '@/lib/ollama/job-searcher';
import { JobRanker } from '@/lib/matching/ranker';
import { JobStorage } from '@/lib/jobs/storage';

/**
 * POST /api/run-match
 *
 * Complete job matching flow:
 * 1. Parse resume PDF (assets/docs/resume.pdf)
 * 2. Store extracted data in database
 * 3. Use Ollama to search for jobs
 * 4. Match and rank jobs based on resume
 *
 * Returns progress updates via JSON
 */
export async function POST(request: Request) {
  try {
    // Initialize progress tracking
    const progress: string[] = [];
    const addProgress = (status: string) => {
      progress.push(status);
      console.log(status);
    };

    // STEP 1: Parse resume PDF
    addProgress('📄 Step 1/4: Reading resume PDF...');
    let resumeData;
    try {
      resumeData = await ResumeParser.parseResume();
      addProgress(`✅ Extracted ${resumeData.skills.length} skills, ${resumeData.experiences.length} experiences`);
    } catch (error) {
      addProgress(`❌ Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse resume PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
        progress,
      }, { status: 500 });
    }

    // STEP 2: Store in database
    addProgress('💾 Step 2/4: Storing resume data in database...');
    let userId: string | null = null;
    try {
      const resumeId = await ResumeStorage.storeResumeData(resumeData);
      addProgress(`✅ Resume stored with ID: ${resumeId}`);

      // Get user ID for storing job matches
      const resume = await ResumeStorage.getDefaultResume();
      if (resume) {
        userId = resume.userId;
      }
    } catch (error) {
      addProgress(`⚠️ Database storage failed (continuing anyway): ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue even if storage fails
    }

    // STEP 3: Search for jobs using Ollama (Ollama-only, no scrapers)
    addProgress('🔍 Step 3/4: Searching for jobs with Ollama...');
    addProgress(`Job titles to search: ${resumeData.jobTitles.join(', ')}`);

    let jobs;
    try {
      const searcher = new OllamaJobSearcher();
      jobs = await searcher.searchJobs(resumeData, addProgress);

      addProgress(`✅ Ollama found ${jobs.length} relevant job opportunities`);
    } catch (error) {
      addProgress(`❌ Job search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return NextResponse.json({
        success: false,
        error: 'Failed to search for jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
        progress,
      }, { status: 500 });
    }

    // STEP 4: Match and rank jobs
    addProgress('📊 Step 4/4: Matching and ranking jobs...');

    const rankedJobs = JobRanker.matchAndRank(resumeData, jobs, addProgress);
    const topMatches = JobRanker.getTopMatches(rankedJobs, 10);

    addProgress(`✅ Complete! Found ${topMatches.length} top matches`);

    // STEP 5: Store jobs and matches in database
    if (userId) {
      try {
        addProgress('💾 Saving jobs and matches to database...');

        // Store all jobs
        const jobIds = await JobStorage.storeJobs(jobs);
        addProgress(`✅ Stored ${jobIds.length} jobs in database`);

        // Store job matches (pair job IDs with matches)
        const matchesToStore = topMatches.map((match, idx) => ({
          jobId: jobIds[jobs.indexOf(match.job)] || jobIds[idx],
          match,
        })).filter(m => m.jobId); // Only include matches with valid job IDs

        const matchIds = await JobStorage.storeJobMatches(userId, matchesToStore);
        addProgress(`✅ Stored ${matchIds.length} job matches`);
      } catch (error) {
        addProgress(`⚠️ Failed to save jobs to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue anyway - jobs are still shown in UI
      }
    }

    // Format response
    return NextResponse.json({
      success: true,
      data: {
        resumeData: {
          name: resumeData.name,
          email: resumeData.email,
          skills: resumeData.skills,
          jobTitles: resumeData.jobTitles,
          experienceCount: resumeData.experiences.length,
        },
        jobsSearched: jobs.length,
        topMatches: topMatches.map(match => ({
          platform: match.job.platform,
          title: match.job.title,
          company: match.job.company,
          location: match.job.location,
          salary: match.job.salary,
          url: match.job.url,
          postedDate: match.job.postedDate,
          scores: {
            overall: Math.round(match.scores.overall * 100),
            skillMatch: Math.round(match.scores.skillMatch * 100),
            titleMatch: Math.round(match.scores.titleMatch * 100),
            topApplicant: Math.round(match.scores.topApplicant * 100),
          },
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          reason: match.reason,
        })),
      },
      progress,
    });

  } catch (error) {
    console.error('Run match error:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to run job match',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
