import pdf from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';

/**
 * Resume Parser
 * Extracts structured data from resume PDF using pdf-parse and pattern matching
 */

export interface ExtractedResumeData {
  fullText: string;
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experiences: Array<{
    title: string;
    company?: string;
    duration?: string;
    description?: string;
  }>;
  education: Array<{
    degree?: string;
    institution?: string;
    year?: string;
  }>;
  jobTitles: string[];
  summary?: string;
}

export class ResumeParser {
  /**
   * Parse resume PDF from assets/docs/resume.pdf
   */
  static async parseResume(): Promise<ExtractedResumeData> {
    const resumePath = path.join(process.cwd(), 'assets', 'docs', 'resume.pdf');

    console.log('📄 Reading resume PDF...');
    const dataBuffer = await fs.readFile(resumePath);

    console.log('🔍 Extracting text from PDF...');
    const pdfData = await pdf(dataBuffer);
    const fullText = pdfData.text;

    console.log(`✅ Extracted ${fullText.length} characters from resume`);

    // Extract structured data
    const name = this.extractName(fullText);
    const email = this.extractEmail(fullText);
    const phone = this.extractPhone(fullText);
    const skills = this.extractSkills(fullText);
    const experiences = this.extractExperiences(fullText);
    const education = this.extractEducation(fullText);
    const jobTitles = this.extractJobTitles(experiences);
    const summary = this.extractSummary(fullText);

    return {
      fullText,
      name,
      email,
      phone,
      skills,
      experiences,
      education,
      jobTitles,
      summary,
    };
  }

  /**
   * Extract name (usually at the top of the resume)
   */
  private static extractName(text: string): string | undefined {
    // Try to find name in the first few lines
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // First non-empty line is often the name
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim();
      // Name is usually 2-4 words, each capitalized, may have middle initial with period
      // Supports names like "McRupert C. Onrejas" (mixed case surnames)
      if (/^[A-Z][A-Za-z]+(\s+[A-Z]\.?\s*)?(\s+[A-Z][A-Za-z]+){0,2}$/.test(trimmed)) {
        return trimmed;
      }
    }

    return undefined;
  }

  /**
   * Extract email address
   */
  private static extractEmail(text: string): string | undefined {
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    return emailMatch ? emailMatch[0] : undefined;
  }

  /**
   * Extract phone number
   */
  private static extractPhone(text: string): string | undefined {
    const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    return phoneMatch ? phoneMatch[0] : undefined;
  }

  /**
   * Extract skills from resume
   */
  private static extractSkills(text: string): string[] {
    const skills = new Set<string>();
    const lowerText = text.toLowerCase();

    // Common technical skills
    const skillKeywords = [
      // Programming languages
      'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala',
      // Frontend
      'react', 'reactjs', 'vue', 'vuejs', 'angular', 'next.js', 'nextjs', 'svelte', 'html', 'css', 'sass', 'tailwind',
      // Backend
      'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'rails', 'laravel', 'asp.net', '.net', 'fastapi',
      // Databases
      'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra',
      // Cloud & DevOps
      'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'jenkins', 'ci/cd', 'git', 'github', 'gitlab',
      // Mobile
      'ios', 'android', 'react native', 'flutter', 'xamarin',
      // Data & ML
      'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'spark', 'kafka', 'airflow', 'machine learning', 'deep learning',
      // Other
      'graphql', 'rest', 'api', 'microservices', 'agile', 'scrum', 'testing', 'jest', 'cypress', 'selenium',
    ];

    for (const skill of skillKeywords) {
      const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (pattern.test(lowerText)) {
        // Get the original casing from text
        const match = text.match(pattern);
        skills.add(match ? match[0] : skill);
      }
    }

    return Array.from(skills);
  }

  /**
   * Extract work experiences
   */
  private static extractExperiences(text: string): Array<{title: string; company?: string; duration?: string; description?: string}> {
    const experiences: Array<{title: string; company?: string; duration?: string; description?: string}> = [];

    // Find experience section - must match as a section header (start of line or after newline)
    const expSectionMatch = text.match(/(?:^|\n)(PROFESSIONAL\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT|WORK\s+HISTORY)\s*\n([\s\S]*?)(?:\nEDUCATION|\nCERTIFICATIONS|$)/i);
    if (!expSectionMatch) return experiences;

    const expSection = expSectionMatch[2]; // Group 2 contains the section content

    // Split by job entries - look for lines that have job titles followed by company/date info
    // Pattern: Job Title\nCompany | Date Range | Location
    const jobEntryPattern = /^(.+?(?:Developer|Engineer|Programmer|Agent|Designer|Analyst|Manager|Lead|Specialist))\s*(?:\(.*?\))?\s*\n(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)$/gim;

    const matches = expSection.matchAll(jobEntryPattern);
    for (const match of matches) {
      const title = match[1].trim();
      const company = match[2].trim();
      const duration = match[3].trim();
      const location = match[4].trim();

      experiences.push({
        title,
        company,
        duration,
        description: `Location: ${location}`,
      });
    }

    // Fallback: If no matches, try simpler pattern matching
    if (experiences.length === 0) {
      const lines = expSection.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for job titles (lines ending with common job title words)
        if (/(?:Developer|Engineer|Programmer|Agent|Designer|Analyst|Manager|Lead|Specialist)(?:\s*\(.*?\))?$/i.test(line)) {
          const title = line.replace(/\s*\(.*?\)\s*$/, '').trim(); // Remove (Part-Time) etc

          // Next line usually has company | dates | location
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const parts = nextLine.split('|').map(p => p.trim());

            if (parts.length >= 2) {
              experiences.push({
                title,
                company: parts[0] || undefined,
                duration: parts[1] || undefined,
                description: parts[2] ? `Location: ${parts[2]}` : undefined,
              });
            }
          }
        }
      }
    }

    return experiences;
  }

  /**
   * Extract education
   */
  private static extractEducation(text: string): Array<{degree?: string; institution?: string; year?: string}> {
    const education: Array<{degree?: string; institution?: string; year?: string}> = [];

    // Find education section
    const eduSectionMatch = text.match(/(?:education|academic)([\s\S]*?)(?:experience|skills|projects|$)/i);
    if (!eduSectionMatch) return education;

    const eduSection = eduSectionMatch[1];

    // Degree patterns
    const degreePatterns = [
      /\b(bachelor|master|phd|doctorate|associate|diploma|certificate)(?:'s)?\s+(?:of\s+)?(?:science|arts|engineering|business|computer science|cs)\b/gi,
      /\b(b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?)(?:\s+in\s+[a-z\s]+)?/gi,
    ];

    for (const pattern of degreePatterns) {
      const matches = eduSection.matchAll(pattern);
      for (const match of matches) {
        const degree = match[0].trim();

        // Try to find institution
        const degreeIndex = eduSection.indexOf(match[0]);
        const lineEnd = eduSection.indexOf('\n', degreeIndex + match[0].length + 1);
        const snippet = eduSection.substring(degreeIndex, lineEnd > 0 ? lineEnd : degreeIndex + 200);

        const institutionMatch = snippet.match(/(?:from|at)?\s*([A-Z][A-Za-z\s&,.]+(?:University|College|Institute|School))/);
        const institution = institutionMatch ? institutionMatch[1].trim() : undefined;

        // Try to find year
        const yearMatch = snippet.match(/\b(20\d{2}|19\d{2})\b/);
        const year = yearMatch ? yearMatch[0] : undefined;

        education.push({
          degree,
          institution,
          year,
        });
      }
    }

    return education;
  }

  /**
   * Extract job titles from experiences (for job search)
   */
  private static extractJobTitles(experiences: Array<{title: string}>): string[] {
    const titles = new Set<string>();

    // Add all experience titles
    for (const exp of experiences) {
      titles.add(exp.title);
    }

    // If no titles found, add common alternatives
    if (titles.size === 0) {
      titles.add('Software Engineer');
      titles.add('Full Stack Developer');
      titles.add('Web Developer');
    }

    return Array.from(titles);
  }

  /**
   * Extract professional summary
   */
  private static extractSummary(text: string): string | undefined {
    // Look for summary/objective section
    const summaryMatch = text.match(/(?:summary|objective|profile|about)([\s\S]{0,500}?)(?:\n\n|experience|education|skills)/i);

    if (summaryMatch) {
      return summaryMatch[1].trim();
    }

    // If no summary section, take first paragraph after name/contact
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      // Skip lines that look like headers or contact info
      if (line.length > 50 && !line.match(/@|phone|email|linkedin|github/i)) {
        return line;
      }
    }

    return undefined;
  }
}
