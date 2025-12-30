import { GoogleGenAI } from '@google/genai';
import { APIError, ValidationError } from '../utils/errorHandler';

interface ResumeData {
    personalInfo: {
        name: string;
        email: string;
        phone: string;
        location: string;
        linkedin?: string;
        github?: string;
        portfolio?: string;
    };
    summary: string;
    experience: Array<{
        company: string;
        position: string;
        duration: string;
        description: string[];
        achievements: string[];
    }>;
    education: Array<{
        institution: string;
        degree: string;
        duration: string;
        gpa?: string;
    }>;
    skills: {
        technical: string[];
        soft: string[];
        languages?: string[];
        certifications?: string[];
    };
    projects?: Array<{
        name: string;
        description: string;
        technologies: string[];
        link?: string;
    }>;
}

interface JobDescription {
    title: string;
    company: string;
    location: string;
    type: string;
    description: string;
    requirements: string[];
    qualifications: string[];
    responsibilities: string[];
    skills: string[];
    experience: string;
    salary?: string;
    benefits?: string[];
}

interface ResumeAnalysis {
    overallScore: number;
    atsScore: number;
    keywordMatch: number;
    structureScore: number;
    contentScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    missingKeywords: string[];
    formattingIssues: string[];
}

interface JobMatch {
    score: number;
    confidence: number;
    matchingSkills: string[];
    missingSkills: string[];
    experienceMatch: string;
    educationMatch: string;
    recommendations: string[];
    salaryExpectation?: string;
}

interface OptimizedResume {
    original: ResumeData;
    optimized: ResumeData;
    changes: Array<{
        section: string;
        type: 'added' | 'modified' | 'removed';
        description: string;
        before?: string;
        after?: string;
    }>;
    improvements: string[];
    atsOptimized: boolean;
}

class ResumeOptimizationService {
    private ai: GoogleGenAI;
    private readonly model = 'gemini-1.5-flash';

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new APIError('Resume optimization requires GEMINI_API_KEY');
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    // Analyze resume against job description
    async analyzeResume(resume: ResumeData, jobDescription: JobDescription): Promise<ResumeAnalysis> {
        const prompt = `
As an expert resume analyzer and ATS specialist, analyze this resume against the job description:

RESUME:
${JSON.stringify(resume, null, 2)}

JOB DESCRIPTION:
${JSON.stringify(jobDescription, null, 2)}

Provide analysis in this JSON format:
{
    "overallScore": 85,
    "atsScore": 80,
    "keywordMatch": 75,
    "structureScore": 90,
    "contentScore": 85,
    "strengths": ["Strong technical skills", "Relevant experience", "Good structure"],
    "weaknesses": ["Missing key keywords", "Weak action verbs", "Poor quantification"],
    "recommendations": ["Add more quantifiable achievements", "Include keywords from job description", "Improve action verbs"],
    "missingKeywords": ["Agile", "Scrum", "Jenkins", "AWS"],
    "formattingIssues": ["Inconsistent bullet points", "Missing contact info"]
}

Focus on:
1. ATS compatibility and keyword matching
2. Structure and formatting best practices
3. Content quality and relevance
4. Experience and education alignment
5. Skills matching and gaps
6. Action verbs and achievements
7. Quantification and metrics
8. Professional summary effectiveness
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error analyzing resume:', error);
            throw new APIError('Failed to analyze resume');
        }
    }

    // Calculate job match score
    async calculateJobMatch(resume: ResumeData, jobDescription: JobDescription): Promise<JobMatch> {
        const prompt = `
As an expert job matching specialist, calculate the match between this resume and job description:

RESUME:
${JSON.stringify(resume, null, 2)}

JOB DESCRIPTION:
${JSON.stringify(jobDescription, null, 2)}

Provide match analysis in this JSON format:
{
    "score": 85,
    "confidence": 0.8,
    "matchingSkills": ["JavaScript", "React", "Node.js", "Agile"],
    "missingSkills": ["Docker", "Kubernetes", "AWS"],
    "experienceMatch": "Strong match - 5+ years relevant experience",
    "educationMatch": "Good match - Bachelor's degree in Computer Science",
    "recommendations": ["Learn Docker and Kubernetes", "Highlight cloud experience", "Add AWS certification"],
    "salaryExpectation": "$120,000 - $140,000"
}

Focus on:
1. Skills alignment and gaps
2. Experience level matching
3. Education requirements
4. Industry experience relevance
5. Career progression alignment
6. Salary expectations based on market data
7. Specific recommendations for improvement
8. Confidence level in assessment
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error calculating job match:', error);
            throw new APIError('Failed to calculate job match');
        }
    }

    // Optimize resume for ATS and job matching
    async optimizeResume(resume: ResumeData, jobDescription: JobDescription): Promise<OptimizedResume> {
        const prompt = `
As an expert resume writer and ATS specialist, optimize this resume for the target job:

ORIGINAL RESUME:
${JSON.stringify(resume, null, 2)}

TARGET JOB DESCRIPTION:
${JSON.stringify(jobDescription, null, 2)}

Provide optimized resume in this JSON format:
{
    "optimized": {
        "personalInfo": { ... },
        "summary": "Optimized professional summary",
        "experience": [
            {
                "company": "Company Name",
                "position": "Position",
                "duration": "2020-Present",
                "description": ["Optimized bullet point 1", "Optimized bullet point 2"],
                "achievements": ["Quantified achievement 1", "Quantified achievement 2"]
            }
        ],
        "education": [ ... ],
        "skills": {
            "technical": ["Skill 1", "Skill 2"],
            "soft": ["Soft skill 1", "Soft skill 2"]
        }
    },
    "changes": [
        {
            "section": "summary",
            "type": "modified",
            "description": "Enhanced summary with keywords",
            "before": "Old summary",
            "after": "New optimized summary"
        }
    ],
    "improvements": ["Added quantifiable achievements", "Included ATS keywords", "Improved action verbs"],
    "atsOptimized": true
}

Optimization Guidelines:
1. Include relevant keywords from job description
2. Use strong action verbs (Led, Developed, Implemented, etc.)
3. Quantify achievements with metrics and numbers
4. Improve structure for ATS readability
5. Enhance professional summary
6. Optimize experience descriptions
7. Ensure consistent formatting
8. Highlight relevant skills and certifications
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            const optimizedData = JSON.parse(jsonMatch[0]);
            
            return {
                original: resume,
                optimized: optimizedData.optimized,
                changes: optimizedData.changes,
                improvements: optimizedData.improvements,
                atsOptimized: optimizedData.atsOptimized
            };
        } catch (error) {
            console.error('Error optimizing resume:', error);
            throw new APIError('Failed to optimize resume');
        }
    }

    // Generate cover letter
    async generateCoverLetter(resume: ResumeData, jobDescription: JobDescription): Promise<{
        letter: string;
        tone: 'professional' | 'enthusiastic' | 'formal';
        length: 'concise' | 'standard' | 'detailed';
        keyPoints: string[];
    }> {
        const prompt = `
As an expert cover letter writer, generate a compelling cover letter based on:

RESUME:
${JSON.stringify(resume, null, 2)}

JOB DESCRIPTION:
${JSON.stringify(jobDescription, null, 2)}

Generate cover letter in this JSON format:
{
    "letter": "Full cover letter text with proper formatting",
    "tone": "professional",
    "length": "standard",
    "keyPoints": ["Key selling point 1", "Key selling point 2", "Key selling point 3"]
}

Cover Letter Guidelines:
1. Address specific job requirements
2. Highlight relevant experience and skills
3. Show enthusiasm for the role and company
4. Include quantifiable achievements
5. Demonstrate cultural fit
6. Professional tone and structure
7. 3-4 paragraphs maximum
8. Strong call to action
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error generating cover letter:', error);
            throw new APIError('Failed to generate cover letter');
        }
    }

    // Extract resume text from file (mock implementation)
    async extractResumeText(file: File): Promise<string> {
        // In production, this would use actual file parsing libraries
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                resolve(text);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Parse resume text into structured data
    async parseResumeText(resumeText: string): Promise<ResumeData> {
        const prompt = `
Parse this resume text into structured JSON format:

RESUME TEXT:
${resumeText}

Parse into this JSON format:
{
    "personalInfo": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "555-123-4567",
        "location": "New York, NY",
        "linkedin": "linkedin.com/in/johndoe",
        "github": "github.com/johndoe",
        "portfolio": "johndoe.com"
    },
    "summary": "Professional summary text",
    "experience": [
        {
            "company": "Company Name",
            "position": "Position Title",
            "duration": "2020-Present",
            "description": ["Responsibility 1", "Responsibility 2"],
            "achievements": ["Achievement 1", "Achievement 2"]
        }
    ],
    "education": [
        {
            "institution": "University Name",
            "degree": "Bachelor of Science in Computer Science",
            "duration": "2016-2020",
            "gpa": "3.8"
        }
    ],
    "skills": {
        "technical": ["JavaScript", "React", "Node.js"],
        "soft": ["Leadership", "Communication"],
        "languages": ["English", "Spanish"],
        "certifications": ["AWS Certified Developer"]
    },
    "projects": [
        {
            "name": "Project Name",
            "description": "Project description",
            "technologies": ["React", "Node.js"],
            "link": "https://github.com/user/project"
        }
    ]
}

Focus on:
1. Extract all sections accurately
2. Parse dates and durations
3. Identify skills and technologies
4. Extract achievements and metrics
5. Handle various resume formats
6. Maintain data consistency
7. Capture contact information
8. Parse education details
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error parsing resume text:', error);
            throw new APIError('Failed to parse resume text');
        }
    }

    // Get job recommendations based on resume
    async getJobRecommendations(resume: ResumeData, preferences: {
        locations: string[];
        jobTypes: string[];
        industries: string[];
        salaryRange?: string;
        remote?: boolean;
    }): Promise<Array<{
        title: string;
        company: string;
        location: string;
        matchScore: number;
        description: string;
        whyMatch: string;
        nextSteps: string[];
    }>> {
        const prompt = `
Based on this resume and preferences, recommend suitable jobs:

RESUME:
${JSON.stringify(resume, null, 2)}

PREFERENCES:
${JSON.stringify(preferences, null, 2)}

Recommend 5 jobs in this JSON format:
{
    "recommendations": [
        {
            "title": "Senior Software Engineer",
            "company": "Tech Company",
            "location": "San Francisco, CA",
            "matchScore": 90,
            "description": "Job description summary",
            "whyMatch": "Strong alignment in skills and experience",
            "nextSteps": ["Update resume with cloud experience", "Prepare for technical interview"]
        }
    ]
}

Recommendation Guidelines:
1. Match skills and experience level
2. Consider location preferences
3. Align with career goals
4. Match salary expectations
5. Consider company culture fit
6. Include growth opportunities
7. Provide actionable next steps
8. Explain match rationale
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.recommendations || [];
        } catch (error) {
            console.error('Error getting job recommendations:', error);
            throw new APIError('Failed to get job recommendations');
        }
    }

    // Validate resume format and content
    validateResume(resume: ResumeData): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check required fields
        if (!resume.personalInfo.name) errors.push('Name is required');
        if (!resume.personalInfo.email) errors.push('Email is required');
        if (!resume.personalInfo.phone) errors.push('Phone is required');
        if (!resume.summary) errors.push('Summary is required');

        // Check experience
        if (!resume.experience || resume.experience.length === 0) {
            errors.push('At least one experience entry is required');
        }

        // Check education
        if (!resume.education || resume.education.length === 0) {
            warnings.push('Education information is recommended');
        }

        // Check skills
        if (!resume.skills.technical || resume.skills.technical.length === 0) {
            warnings.push('Technical skills are recommended');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (resume.personalInfo.email && !emailRegex.test(resume.personalInfo.email)) {
            errors.push('Invalid email format');
        }

        // Check summary length
        if (resume.summary && (resume.summary.length < 50 || resume.summary.length > 500)) {
            warnings.push('Summary should be between 50-500 characters');
        }

        // Check experience descriptions
        resume.experience?.forEach((exp, index) => {
            if (!exp.company) errors.push(`Company name missing in experience ${index + 1}`);
            if (!exp.position) errors.push(`Position missing in experience ${index + 1}`);
            if (!exp.duration) errors.push(`Duration missing in experience ${index + 1}`);
            if (!exp.description || exp.description.length === 0) {
                warnings.push(`Add description for experience ${index + 1}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // Generate resume in different formats
    async generateResumeFormats(resume: ResumeData): Promise<{
        pdf: string; // Base64 encoded PDF
        docx: string; // Base64 encoded DOCX
        txt: string; // Plain text
        html: string; // HTML format
    }> {
        // This is a simplified implementation
        // In production, would use actual document generation libraries
        
        const plainText = this.generatePlainTextResume(resume);
        const html = this.generateHTMLResume(resume);
        
        return {
            pdf: '', // Would generate actual PDF
            docx: '', // Would generate actual DOCX
            txt: plainText,
            html
        };
    }

    private generatePlainTextResume(resume: ResumeData): string {
        let text = '';
        
        // Personal info
        text += `${resume.personalInfo.name}\n`;
        text += `${resume.personalInfo.email} | ${resume.personalInfo.phone} | ${resume.personalInfo.location}\n`;
        if (resume.personalInfo.linkedin) text += `LinkedIn: ${resume.personalInfo.linkedin}\n`;
        if (resume.personalInfo.github) text += `GitHub: ${resume.personalInfo.github}\n`;
        text += '\n';
        
        // Summary
        text += `PROFESSIONAL SUMMARY\n${resume.summary}\n\n`;
        
        // Experience
        text += `EXPERIENCE\n`;
        resume.experience.forEach(exp => {
            text += `${exp.position} - ${exp.company} (${exp.duration})\n`;
            exp.description.forEach(desc => text += `• ${desc}\n`);
            exp.achievements.forEach(ach => text += `★ ${ach}\n`);
            text += '\n';
        });
        
        // Education
        text += `EDUCATION\n`;
        resume.education.forEach(edu => {
            text += `${edu.degree} - ${edu.institution} (${edu.duration})\n`;
            if (edu.gpa) text += `GPA: ${edu.gpa}\n`;
            text += '\n';
        });
        
        // Skills
        text += `SKILLS\n`;
        text += `Technical: ${resume.skills.technical.join(', ')}\n`;
        text += `Soft Skills: ${resume.skills.soft.join(', ')}\n`;
        if (resume.skills.languages) {
            text += `Languages: ${resume.skills.languages.join(', ')}\n`;
        }
        
        return text;
    }

    private generateHTMLResume(resume: ResumeData): string {
        let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${resume.personalInfo.name} - Resume</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; }
        .section { margin: 20px 0; }
        .job { margin: 15px 0; }
        ul { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${resume.personalInfo.name}</h1>
        <p>${resume.personalInfo.email} | ${resume.personalInfo.phone} | ${resume.personalInfo.location}</p>
    </div>
    
    <div class="section">
        <h2>Professional Summary</h2>
        <p>${resume.summary}</p>
    </div>
    
    <div class="section">
        <h2>Experience</h2>
`;

        resume.experience.forEach(exp => {
            html += `
        <div class="job">
            <h3>${exp.position} - ${exp.company}</h3>
            <p><em>${exp.duration}</em></p>
            <ul>`;
            exp.description.forEach(desc => {
                html += `<li>${desc}</li>`;
            });
            if (exp.achievements.length > 0) {
                html += `<h4>Achievements:</h4><ul>`;
                exp.achievements.forEach(ach => {
                    html += `<li>${ach}</li>`;
                });
                html += '</ul>';
            }
            html += '</ul></div>';
        });

        html += `
    </div>
    
    <div class="section">
        <h2>Education</h2>
`;

        resume.education.forEach(edu => {
            html += `
        <div>
            <h3>${edu.degree}</h3>
            <p>${edu.institution} (${edu.duration})</p>
            ${edu.gpa ? `<p>GPA: ${edu.gpa}</p>` : ''}
        </div>`;
        });

        html += `
    </div>
    
    <div class="section">
        <h2>Skills</h2>
        <p><strong>Technical:</strong> ${resume.skills.technical.join(', ')}</p>
        <p><strong>Soft Skills:</strong> ${resume.skills.soft.join(', ')}</p>
        ${resume.skills.languages ? `<p><strong>Languages:</strong> ${resume.skills.languages.join(', ')}</p>` : ''}
    </div>
</body>
</html>`;

        return html;
    }
}

export const resumeOptimizationService = new ResumeOptimizationService();
export default resumeOptimizationService;
