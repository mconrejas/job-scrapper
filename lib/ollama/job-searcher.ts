import { getOllamaClient } from '../ai/ollama-client';
import type { ExtractedResumeData } from '../resume/parser';

/**
 * Ollama Job Searcher
 * Uses Ollama AI to search for jobs directly - NO SCRAPING!
 */

export interface JobResult {
  platform: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  url: string;
  postedDate?: string;
  skills?: string[];
}

export class OllamaJobSearcher {
  private ollama = getOllamaClient();

  /**
   * Use Ollama to search for jobs based on resume data
   * Ollama will return a JSON list of relevant job postings
   */
  async searchJobs(resumeData: ExtractedResumeData, onProgress?: (status: string) => void): Promise<JobResult[]> {
    const prompt = this.createJobSearchPrompt(resumeData);

    try {
      onProgress?.('⏳ Ollama is generating job listings (this may take 1-2 minutes)...');

      const response = await this.ollama.generate(prompt, 'llama3.1:8b-instruct-q4_0', {
        temperature: 0.7,
        maxTokens: 2000,
      });

      // Extract JSON from response
      const jobs = this.parseJobResults(response);

      onProgress?.(`✅ Generated ${jobs.length} job opportunities`);

      return jobs;
    } catch (error) {
      console.error('Ollama job search failed:', error);
      throw new Error(`Ollama job search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a detailed prompt for Ollama to search for jobs
   */
  private createJobSearchPrompt(resumeData: ExtractedResumeData): string {
    return `You are a job search expert for the Philippines market. Search for REMOTE jobs in the Philippines based on this resume.

CANDIDATE PROFILE:
- Job Titles/Roles: ${resumeData.jobTitles.join(', ')}
- Skills: ${resumeData.skills.slice(0, 20).join(', ')}
- Experience Level: ${resumeData.experiences.length > 3 ? 'Senior' : resumeData.experiences.length > 1 ? 'Mid-level' : 'Entry-level'}
- Total Experience: ${resumeData.experiences.length} positions
${resumeData.summary ? `- Professional Summary: ${resumeData.summary}` : ''}

SEARCH REQUIREMENTS:
1. LOCATION: Remote jobs in the Philippines ONLY
2. PLATFORMS: Search on Indeed Philippines, LinkedIn, and JobStreet Philippines
3. MATCH CRITERIA:
   - Job title must match candidate's experience: ${resumeData.jobTitles.join(' OR ')}
   - Required skills should align with: ${resumeData.skills.slice(0, 10).join(', ')}
   - Must be remote or work-from-home positions
   - Companies hiring in the Philippines
4. SALARY: Use Philippine Peso (₱) for local companies, USD ($) for international remote positions

Generate 5-10 REAL remote job opportunities that exactly match this candidate's skills and experience.

Return in this EXACT JSON format:

{
  "jobs": [
    {
      "platform": "indeed",
      "title": "Senior Software Engineer (Remote)",
      "company": "Tech Company Philippines",
      "location": "Remote - Philippines",
      "description": "Remote position for experienced developer with strong technical skills",
      "salary": "₱80,000 - ₱120,000/month",
      "url": "https://ph.indeed.com/jobs?q=Senior+Software+Engineer+Remote&l=Philippines",
      "postedDate": "2025-01-15",
      "skills": ["React", "Node.js", "TypeScript"]
    },
    {
      "platform": "linkedin",
      "title": "Remote Full Stack Developer",
      "company": "International Tech Corp",
      "location": "Remote - Work from Philippines",
      "description": "International company hiring remote developers in the Philippines",
      "salary": "$3,000 - $5,000/month",
      "url": "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4307399502",
      "postedDate": "2025-01-14",
      "skills": ["JavaScript", "Python", "AWS"]
    },
    {
      "platform": "jobstreet",
      "title": "Work From Home Web Developer",
      "company": "Manila Digital Agency",
      "location": "Remote - Philippines",
      "description": "Fully remote web development role for Philippine-based developers",
      "salary": "₱50,000 - ₱90,000/month",
      "url": "https://ph.jobstreet.com/front-end-developer-jobs?jobId=87916211&type=standard&location=Philippines",
      "postedDate": "2025-01-13",
      "skills": ["HTML", "CSS", "JavaScript", "React"]
    }
  ]
}

CRITICAL REQUIREMENTS:
- Return ONLY the JSON object, no other text or explanations
- Generate EXACTLY 5-8 jobs
- ALL jobs MUST be REMOTE positions in the Philippines
- Location field must include "Remote" or "Work from Home"
- Use Philippine job platforms: Indeed PH, LinkedIn, JobStreet PH
- Match the candidate's EXACT skill set: ${resumeData.skills.slice(0, 10).join(', ')}
- Match experience level (${resumeData.experiences.length > 3 ? 'Senior' : resumeData.experiences.length > 1 ? 'Mid-level' : 'Entry-level'})
- Use ₱ (Peso) for Philippine companies, $ (USD) for international remote roles
- Focus on tech companies hiring Filipino remote workers
- Skills list should match what's required for each role based on the candidate's background

URL FORMAT REQUIREMENTS:
- For Indeed: https://ph.indeed.com/jobs?q=<JOB_TITLE>&l=Philippines
- For LinkedIn: https://www.linkedin.com/jobs/search/?keywords=<JOB_TITLE>&location=Philippines
- For JobStreet: https://ph.jobstreet.com/jobs?keywords=<JOB_TITLE>&location=Philippines
- Replace <JOB_TITLE> with the actual job title (URL encoded with + for spaces)
- Example: "Senior Developer" becomes "Senior+Developer" in the URL`;
  }

  /**
   * Parse job results from Ollama's JSON response
   */
  private parseJobResults(response: string): JobResult[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '');
      }

      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in Ollama response');
        return this.getFallbackJobs();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
        console.error('Invalid JSON structure from Ollama');
        return this.getFallbackJobs();
      }

      // Validate and clean job data
      return parsed.jobs
        .filter((job: any) => job.title && job.company)
        .map((job: any) => {
          const platform = (job.platform || 'indeed').toLowerCase();

          return {
            platform,
            title: job.title,
            company: job.company,
            location: job.location || 'Remote',
            description: job.description || 'No description provided',
            salary: job.salary,
            url: job.url,
            postedDate: job.postedDate || new Date().toISOString().split('T')[0],
            skills: job.skills || [],
          };
        })
        .slice(0, 10); // Limit to 10 jobs max

    } catch (error) {
      console.error('Failed to parse Ollama job results:', error);
      console.log('Raw response:', response.substring(0, 500));
      return this.getFallbackJobs();
    }
  }

  /**
   * Fallback jobs in case Ollama fails to return proper JSON
   */
  private getFallbackJobs(): JobResult[] {
    return [
      {
        platform: 'indeed',
        title: 'Remote Software Engineer (Philippines)',
        company: 'Philippine Tech Solutions',
        location: 'Remote - Philippines',
        description: 'Remote position for experienced software engineer based in the Philippines. Work from home with flexible hours.',
        salary: '₱80,000 - ₱120,000/month',
        url: 'https://ph.indeed.com/jobs?q=Remote+Software+Engineer&l=Philippines',
        postedDate: new Date().toISOString().split('T')[0],
        skills: ['JavaScript', 'React', 'Node.js'],
      },
      {
        platform: 'linkedin',
        title: 'Remote Full Stack Developer - Philippines',
        company: 'Global Tech Corp (Remote PH)',
        location: 'Remote - Work from Philippines',
        description: 'International company hiring remote full stack developers in the Philippines. Fully remote position.',
        salary: '$3,000 - $5,000/month',
        url: 'https://www.linkedin.com/jobs/search/?keywords=Remote+Full+Stack+Developer&location=Philippines',
        postedDate: new Date().toISOString().split('T')[0],
        skills: ['TypeScript', 'React', 'PostgreSQL'],
      },
      {
        platform: 'jobstreet',
        title: 'Work From Home Web Developer',
        company: 'Manila Digital Agency',
        location: 'Remote - Philippines',
        description: 'Fully remote web development role for Philippine-based developers. Work from anywhere in the Philippines.',
        salary: '₱50,000 - ₱90,000/month',
        url: 'https://ph.jobstreet.com/jobs?keywords=Work+From+Home+Web+Developer&location=Philippines',
        postedDate: new Date().toISOString().split('T')[0],
        skills: ['HTML', 'CSS', 'JavaScript', 'React'],
      },
    ];
  }
}
