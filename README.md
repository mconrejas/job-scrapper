# Personal AI Job Matcher

An intelligent job matching system powered by **local AI** (Ollama) that analyzes your resume and finds the most relevant job opportunities for you.

## Purpose

This application helps job seekers by:

1. **Extracting data from your resume** - Automatically parses your PDF resume to extract skills, experience, education, and job titles
2. **Finding relevant jobs** - Uses Ollama AI to search and generate job opportunities that match your profile
3. **Intelligent matching** - Ranks jobs based on skill match, title match, experience level, and overall fit
4. **Privacy-first approach** - All processing happens locally on your machine using Ollama - no data is sent to external APIs

## Key Features

- **100% Local AI Processing** - Uses Ollama (llama3.1:8b) for all AI operations
- **Resume Parsing** - Extracts structured data from PDF resumes
- **Smart Job Matching** - Multi-factor scoring algorithm that considers:
  - Skill match (40%)
  - Job title match (30%)
  - Experience level match (30%)
- **Real-time Progress Updates** - See what's happening as the system works
- **Privacy Focused** - Your resume data stays on your machine
- **No Scraping** - AI-generated job listings based on your profile

## Tech Stack

- **Frontend**: Next.js 15.5.5, React 19, TypeScript, Tailwind CSS
- **AI**: Ollama (llama3.1:8b-instruct-q4_0)
- **Database**: PostgreSQL with Prisma ORM
- **Resume Parsing**: pdf-parse
- **Deployment**: Local development

## How It Works

1. Place your resume as `assets/docs/resume.pdf`
2. Click "Run Match" button
3. The system:
   - Parses your resume PDF
   - Stores extracted data in the database
   - Uses Ollama AI to generate 5-8 relevant job opportunities
   - Ranks and scores each job based on your profile
4. View your top matches with detailed scoring and explanations

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** database
- **Ollama** installed and running locally
  - Model required: `llama3.1:8b-instruct-q4_0`

## Installation

### 1. Install Ollama

**Windows:**
```bash
# Download from https://ollama.com
# After installation, pull the model:
ollama pull llama3.1:8b-instruct-q4_0
```

**macOS/Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b-instruct-q4_0
```

### 2. Setup Database

Create a PostgreSQL database and update the connection string in `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/job_matcher"
```

Run migrations:
```bash
npx prisma migrate dev
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Add Your Resume

Place your resume PDF in:
```
assets/docs/resume.pdf
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
job-scrapper/
├── app/
│   ├── api/run-match/route.ts    # Main API endpoint
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Homepage
├── lib/
│   ├── ai/ollama-client.ts        # Ollama API client
│   ├── matching/ranker.ts         # Job ranking algorithm
│   ├── ollama/job-searcher.ts     # AI job search
│   └── resume/
│       ├── parser.ts              # PDF resume parser
│       └── storage.ts             # Database storage
├── prisma/
│   └── schema.prisma              # Database schema
└── assets/docs/resume.pdf         # Your resume
```

## Configuration

Environment variables (`.env`):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/job_matcher"

# Ollama (optional, defaults to localhost:11434)
OLLAMA_URL="http://localhost:11434"
```

## Usage

1. **Start Ollama** (if not already running):
   ```bash
   ollama serve
   ```

2. **Start the application**:
   ```bash
   npm run dev
   ```

3. **Open browser** to [http://localhost:3000](http://localhost:3000)

4. **Click "Run Match"** and wait for results

## Scoring System

Each job is scored across multiple dimensions:

- **Skill Match (40%)** - How many of your skills match the job requirements
- **Title Match (30%)** - How well the job title matches your experience
- **Experience Match (30%)** - Whether the seniority level aligns with your background

Jobs are then ranked by overall score and presented with:
- Matched skills
- Missing skills
- Detailed reasoning for the match

## Troubleshooting

### Ollama Connection Issues

If you see "Cannot connect to Ollama":
```bash
# Make sure Ollama is running
ollama serve

# Verify the model is installed
ollama list
```

### Database Connection Issues

```bash
# Test database connection
npx prisma db push

# View database in browser
npx prisma studio
```

### Timeout Errors

If generation times out, the system has a 5-minute timeout and will fall back to sample jobs. This can happen if:
- Your system is low on resources
- Ollama is processing other requests
- The model is not fully loaded

## License

MIT

## Contributing

This is a personal project for local AI-powered job matching. Feel free to fork and customize for your needs!
