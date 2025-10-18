import { ResumeParser } from '@/lib/resume/parser';
import { ResumeStorage } from '@/lib/resume/storage';
import { OllamaJobSearcher } from '@/lib/ollama/job-searcher';
import { JobRanker } from '@/lib/matching/ranker';
import { JobStorage } from '@/lib/jobs/storage';

/**
 * POST /api/run-match-stream
 *
 * Streams real-time progress updates using Server-Sent Events
 */
export async function POST(request: Request) {
  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE messages
      const sendProgress = (message: string) => {
        const data = `data: ${JSON.stringify({ progress: message })}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      const sendError = (error: string) => {
        const data = `data: ${JSON.stringify({ error })}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      const sendComplete = (payload: any) => {
        const data = `data: ${JSON.stringify({ complete: true, ...payload })}\n\n`;
        controller.enqueue(encoder.encode(data));
        controller.close();
      };

      try {
        // STEP 1: Parse resume PDF
        sendProgress('📄 Reading resume PDF...');

        let resumeData;
        try {
          resumeData = await ResumeParser.parseResume();
          sendProgress(`✅ Extracted ${resumeData.skills.length} skills, ${resumeData.experiences.length} experiences`);
        } catch (error) {
          sendError(`Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
          controller.close();
          return;
        }

        // STEP 2: Store in database
        sendProgress('💾 Saving resume to database...');

        let userId: string | null = null;
        try {
          await ResumeStorage.storeResumeData(resumeData);
          const resume = await ResumeStorage.getDefaultResume();
          if (resume) {
            userId = resume.userId;
          }
          sendProgress('✅ Resume saved');
        } catch (error) {
          sendProgress(`⚠️ Database error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        // STEP 3: Search for jobs using Ollama
        sendProgress(`🤖 Asking Ollama to find jobs for: ${resumeData.jobTitles.join(', ')}`);

        let jobs;
        try {
          const searcher = new OllamaJobSearcher();
          jobs = await searcher.searchJobs(resumeData, sendProgress);
        } catch (error) {
          sendError(`Job search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          controller.close();
          return;
        }

        // STEP 4: Match and rank jobs
        sendProgress('📊 Ranking jobs by match quality...');

        const rankedJobs = JobRanker.matchAndRank(resumeData, jobs, sendProgress);
        const topMatches = JobRanker.getTopMatches(rankedJobs, 10);

        sendProgress(`✅ Found ${topMatches.length} top matches`);

        // STEP 5: Store jobs and matches
        if (userId) {
          try {
            sendProgress('💾 Saving to database...');
            const jobIds = await JobStorage.storeJobs(jobs);
            const matchesToStore = topMatches.map((match, idx) => ({
              jobId: jobIds[jobs.indexOf(match.job)] || jobIds[idx],
              match,
            })).filter(m => m.jobId);

            await JobStorage.storeJobMatches(userId, matchesToStore);
            sendProgress(`✅ Saved ${jobIds.length} jobs and ${matchesToStore.length} matches`);
          } catch (error) {
            sendProgress(`⚠️ Save failed: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
        }

        sendProgress('✅ Complete!');

        // Send final results
        sendComplete({
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
        });

      } catch (error) {
        console.error('Stream error:', error);
        sendError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
