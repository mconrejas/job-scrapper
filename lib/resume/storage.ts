import { PrismaClient } from '@prisma/client';
import type { ExtractedResumeData } from './parser';

const prisma = new PrismaClient();

/**
 * Resume Storage
 * Stores extracted resume data in the database
 */

export class ResumeStorage {
  /**
   * Store or update resume data
   * Creates a default user if none exists
   */
  static async storeResumeData(data: ExtractedResumeData): Promise<string> {
    console.log('💾 Storing resume data to database...');

    // Get or create default user
    let user = await prisma.user.findFirst({
      where: { email: data.email || 'default@resume.local' },
    });

    if (!user) {
      console.log('Creating default user...');
      user = await prisma.user.create({
        data: {
          email: data.email || 'default@resume.local',
          name: data.name || 'Resume User',
        },
      });
    }

    // Check if resume already exists for this user
    const existingResume = await prisma.resume.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    let resumeId: string;

    if (existingResume) {
      console.log('Updating existing resume...');
      // Update existing resume
      const updated = await prisma.resume.update({
        where: { id: existingResume.id },
        data: {
          rawText: data.fullText,
          parsedData: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            summary: data.summary,
            jobTitles: data.jobTitles,
          },
          skills: data.skills,
          experience: data.experiences,
          education: data.education,
          updatedAt: new Date(),
        },
      });
      resumeId = updated.id;
    } else {
      console.log('Creating new resume record...');
      // Create new resume
      const created = await prisma.resume.create({
        data: {
          userId: user.id,
          fileName: 'resume.pdf',
          fileUrl: '/assets/docs/resume.pdf',
          fileType: 'pdf',
          rawText: data.fullText,
          parsedData: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            summary: data.summary,
            jobTitles: data.jobTitles,
          },
          skills: data.skills,
          experience: data.experiences,
          education: data.education,
          isActive: true,
        },
      });
      resumeId = created.id;
    }

    console.log(`✅ Resume data stored with ID: ${resumeId}`);
    return resumeId;
  }

  /**
   * Get the active resume for a user
   */
  static async getActiveResume(userId: string) {
    return prisma.resume.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Get the default user's resume
   */
  static async getDefaultResume() {
    const user = await prisma.user.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!user) return null;

    return this.getActiveResume(user.id);
  }
}
