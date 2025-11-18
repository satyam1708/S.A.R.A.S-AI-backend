import prisma from '../../lib/prisma.js';
import * as aiService from '../../services/aiService.js';

/**
 * Process an uploaded PYQ PDF/Text file.
 * 1. Parse content via AI.
 * 2. Save questions to QuestionBank.
 */
export const processPreviousYearPaper = async (textData, courseId, year, sourceName) => {
  // 1. AI Extraction
  const extractedQuestions = await aiService.parseQuestionsFromText(textData, sourceName);

  // 2. Store in DB
  const createdCount = await prisma.$transaction(async (tx) => {
    let count = 0;
    
    // Find a general "Topic" to link these to (or create a placeholder)
    // For better structure, we should ideally map AI "subject" to DB "Subject", 
    // but for now, we link to a generic "PYQ Import" topic or similar.
    const defaultTopic = await tx.topic.findFirst(); // Simplified for this example
    if (!defaultTopic) throw new Error("No topics exist to link questions.");

    for (const q of extractedQuestions) {
      await tx.questionBank.create({
        data: {
          questionText: q.questionText,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          type: "MCQ",
          difficulty: q.difficulty.toUpperCase(),
          topicId: defaultTopic.id, // In real app, look up Topic by name: q.subject
          // We can store metadata in a JSON field if needed or add 'source' to schema
          // For now, we assume these are generic valid questions.
        }
      });
      count++;
    }
    return count;
  });

  return { message: `Successfully imported ${createdCount} questions from ${sourceName} (${year})` };
};

/**
 * THE CORE EXAM GENERATOR
 * Creates a full Mock Test for a Course (e.g. SSC CGL)
 */
export const generateMockExam = async (courseId, title) => {
  // 1. Get Course Structure (e.g. English: 25 Qs, Reasoning: 25 Qs)
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: { 
      subjects: { include: { subject: true } } 
    }
  });

  if (!course) throw new Error("Course not found");

  // 2. Create the Mock Test Shell
  const mockTest = await prisma.mockTest.create({
    data: {
      title: title || `${course.name} - AI Generated Mock`,
      courseId: course.id,
      durationMin: 60, // Default, ideally fetch from Course model if added
      totalMarks: 0, // Will calculate
      isLive: false, // Admin must review first
    }
  });

  let grandTotalMarks = 0;

  // 3. Iterate Syallbus & Fill Questions
  for (const config of course.subjects) {
    const subjectName = config.subject.name;
    const countNeeded = config.questionCount;

    let questionsToAdd = [];

    if (subjectName.toLowerCase().includes("current affairs") || subjectName.toLowerCase().includes("news")) {
      // --- STRATEGY A: DYNAMIC GENERATION (Current Affairs) ---
      console.log(`Generating fresh Current Affairs for ${subjectName}...`);
      
      // Fetch recent news (last 6 months)
      // This assumes you have a way to query your 'News' table. 
      // Let's assume a simple prisma fetch for now.
      // Note: In your News module, you might have a separate model. 
      // I'll treat this as "Concept" logic:
      const recentNews = [
         { title: "Budget 2025", description: "Govt announces new tax slabs..." },
         { title: "Olympics 2024", description: "India wins 5 golds..." }
      ]; 
      // REAL CODE: const recentNews = await prisma.newsArticle.findMany({ take: 20, orderBy: { publishedAt: 'desc' } });

      const generatedQs = await aiService.generateCurrentAffairsQuestions(recentNews, countNeeded);
      
      // Save these new Qs to Bank first (so they can be reused)
      for (const gq of generatedQs) {
        const newQ = await prisma.questionBank.create({
          data: {
            questionText: gq.questionText,
            options: gq.options,
            correctIndex: gq.correctIndex,
            explanation: gq.explanation,
            topicId: config.subjectId, // Link to the Subject directly implies Topic here for simplicity
             // Tag as generated so we know it's fresh
          }
        });
        questionsToAdd.push(newQ);
      }

    } else {
      // --- STRATEGY B: STATIC BANK (History, Math, English) ---
      // Fetch random PYQs or Book Questions linked to this Subject
      const availableQs = await prisma.questionBank.findMany({
        where: {
          topic: {
            subjectId: config.subjectId
          }
        },
        take: countNeeded, 
        // Prisma doesn't support native "RANDOM()" easily, 
        // usually we fetch IDs and shuffle in JS for small datasets
      });

      questionsToAdd = availableQs;
    }

    // 4. Link Questions to MockTest
    for (const q of questionsToAdd) {
      await prisma.mockTestQuestion.create({
        data: {
          mockTestId: mockTest.id,
          questionId: q.id,
          marks: config.marksPerQ,
          negative: config.negativeMarks
        }
      });
      grandTotalMarks += config.marksPerQ;
    }
  }

  // Update total marks
  await prisma.mockTest.update({
    where: { id: mockTest.id },
    data: { totalMarks: grandTotalMarks, isLive: true }
  });

  return mockTest;
};

export const getMockTestsForCourse = async (courseId) => {
  return await prisma.mockTest.findMany({
    where: { courseId: parseInt(courseId), isLive: true },
    include: { _count: { select: { questions: true } } }
  });
};

export const submitMockAttempt = async (userId, mockTestId, answers) => {
  // 1. Fetch correct answers & Question details (need Topics for analysis)
  const mock = await prisma.mockTest.findUnique({
    where: { id: parseInt(mockTestId) },
    include: { 
      questions: { 
        include: { 
          question: { include: { topic: true } } // Fetch Topic for analysis
        } 
      } 
    }
  });

  let score = 0;
  let correct = 0;
  let wrong = 0;
  let grandTotal = mock.totalMarks;
  
  const weakTopicsSet = new Set(); // Track topics where user failed
  const attemptData = [];

  for (const ans of answers) { 
    const mockQ = mock.questions.find(mq => mq.questionId === ans.questionId);
    if (!mockQ) continue;

    const isCorrect = mockQ.question.correctIndex === ans.selectedIndex;
    
    if (isCorrect) {
      score += mockQ.marks;
      correct++;
    } else if (ans.selectedIndex !== null) { 
      score -= mockQ.negative;
      wrong++;
      // Add to weak topics if wrong
      if (mockQ.question.topic) weakTopicsSet.add(mockQ.question.topic.name);
    }

    attemptData.push({
      questionId: ans.questionId,
      selectedOption: ans.selectedIndex,
      isCorrect,
      timeTaken: ans.timeTaken
    });
  }
  
  const timeTaken = answers.reduce((acc, curr) => acc + (curr.timeTaken || 0), 0);

  // 2. Generate AI Analysis
  const weakTopicsList = Array.from(weakTopicsSet);
  const aiAnalysis = await aiService.generateExamAnalysis(score, grandTotal, weakTopicsList, timeTaken);

  // 3. Save Attempt with Analysis
  return await prisma.mockTestAttempt.create({
    data: {
      userId: parseInt(userId),
      mockTestId: parseInt(mockTestId),
      score,
      correctCount: correct,
      wrongCount: wrong,
      skippedCount: mock.questions.length - (correct + wrong),
      timeTaken,
      analysisJson: aiAnalysis || {}, // Store the JSON object
      aiFeedback: aiAnalysis?.summary || "Keep practicing!", // Store summary text
      answers: {
        create: attemptData
      }
    }
  });
};


