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

  // 2. Store in DB (Optimized with createMany is possible, but transaction is safer for logic)
  const createdCount = await prisma.$transaction(async (tx) => {
    // Find a general "Topic" or placeholder
    const defaultTopic = await tx.topic.findFirst(); 
    if (!defaultTopic) throw new Error("No topics exist to link questions.");

    // Optimization: Prepare data for createMany to reduce DB trips
    const questionsData = extractedQuestions.map(q => ({
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      type: "MCQ",
      difficulty: q.difficulty.toUpperCase(),
      topicId: defaultTopic.id,
    }));

    // Bulk insert is much faster
    await tx.questionBank.createMany({
      data: questionsData
    });

    return questionsData.length;
  });

  return { message: `Successfully imported ${createdCount} questions from ${sourceName} (${year})` };
};

/**
 * THE CORE EXAM GENERATOR (OPTIMIZED)
 * Creates a full Mock Test for a Course (e.g. SSC CGL)
 */
export const generateMockExam = async (courseId, title) => {
  // 1. Get Course Structure
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
      durationMin: 60, 
      totalMarks: 0, 
      isLive: false,
    }
  });

  // 3. Process Subjects in PARALLEL (High Performance Fix)
  // We map over subjects and return a Promise for each, then wait for ALL to finish.
  const subjectProcessingPromises = course.subjects.map(async (config) => {
    const subjectName = config.subject.name;
    const countNeeded = config.questionCount;
    let questionsToAdd = [];

    // A. Dynamic Generation (Current Affairs)
    if (subjectName.toLowerCase().includes("current affairs") || subjectName.toLowerCase().includes("news")) {
      console.log(`Generating fresh Current Affairs for ${subjectName}...`);
      
      // Mock News Data (Replace with DB fetch in production)
      const recentNews = [
         { title: "Budget 2025", description: "Govt announces new tax slabs..." },
         { title: "Olympics 2024", description: "India wins 5 golds..." }
      ];

      // Call AI
      const generatedQs = await aiService.generateCurrentAffairsQuestions(recentNews, countNeeded);
      
      // Save new Qs to Bank in Parallel (not serial loop)
      const savePromises = generatedQs.map(gq => 
        prisma.questionBank.create({
          data: {
            questionText: gq.questionText,
            options: gq.options,
            correctIndex: gq.correctIndex,
            explanation: gq.explanation,
            topicId: config.subjectId, // Assuming Topic ID maps roughly to Subject ID here
            difficulty: "MEDIUM"
          }
        })
      );
      
      // Wait for all questions to be created
      questionsToAdd = await Promise.all(savePromises);

    } else {
      // B. Static Bank (History, Math, etc.)
      // Fetch random questions
      questionsToAdd = await prisma.questionBank.findMany({
        where: {
          topic: { subjectId: config.subjectId }
        },
        take: countNeeded,
      });
    }

    // Prepare the connections for the Junction Table (Don't save yet, just prepare data)
    // We return an array of objects to be inserted later
    return questionsToAdd.map(q => ({
      mockTestId: mockTest.id,
      questionId: q.id,
      marks: config.marksPerQ,
      negative: config.negativeMarks
    }));
  });

  // Wait for ALL subjects to be processed
  const results = await Promise.all(subjectProcessingPromises);
  
  // Flatten the array of arrays [[math_qs], [english_qs]] -> [all_qs]
  const allMockQuestions = results.flat();

  // 4. Bulk Insert Connections (One DB Call instead of N)
  if (allMockQuestions.length > 0) {
    await prisma.mockTestQuestion.createMany({
      data: allMockQuestions
    });
  }

  // 5. Calculate Total Marks locally
  const grandTotalMarks = allMockQuestions.reduce((sum, item) => sum + item.marks, 0);

  // 6. Final Update
  await prisma.mockTest.update({
    where: { id: mockTest.id },
    data: { totalMarks: grandTotalMarks, isLive: true }
  });

  return mockTest;
};

export const getMockTestsForCourse = async (courseId) => {
  // Use select to only fetch what is needed (Latency Optimization)
  return await prisma.mockTest.findMany({
    where: { courseId: parseInt(courseId), isLive: true },
    select: {
      id: true,
      title: true,
      durationMin: true,
      totalMarks: true,
      _count: { select: { questions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const submitMockAttempt = async (userId, mockTestId, answers) => {
  // Fetch Minimal Data needed for grading (Optimization)
  const mock = await prisma.mockTest.findUnique({
    where: { id: parseInt(mockTestId) },
    select: {
      totalMarks: true,
      questions: {
        select: {
          questionId: true,
          marks: true,
          negative: true,
          question: {
            select: {
              correctIndex: true,
              topic: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  if (!mock) throw new Error("Mock test not found");

  let score = 0;
  let correct = 0;
  let wrong = 0;
  
  // Use Map for O(1) lookup instead of .find() which is O(N)
  const questionMap = new Map(mock.questions.map(mq => [mq.questionId, mq]));
  
  const weakTopicsSet = new Set(); 
  const attemptData = [];
  let timeTaken = 0;

  // Grade logic
  for (const ans of answers) { 
    const mockQ = questionMap.get(ans.questionId); // Fast Lookup
    if (!mockQ) continue;

    timeTaken += (ans.timeTaken || 0);
    const isCorrect = mockQ.question.correctIndex === ans.selectedIndex;
    
    if (isCorrect) {
      score += mockQ.marks;
      correct++;
    } else if (ans.selectedIndex !== null && ans.selectedIndex !== undefined) { 
      score -= mockQ.negative;
      wrong++;
      if (mockQ.question.topic?.name) weakTopicsSet.add(mockQ.question.topic.name);
    }

    attemptData.push({
      questionId: ans.questionId,
      selectedOption: ans.selectedIndex,
      isCorrect,
      timeTaken: ans.timeTaken
    });
  }
  
  // Generate AI Analysis in parallel if possible, or just await it
  const weakTopicsList = Array.from(weakTopicsSet);
  const aiAnalysis = await aiService.generateExamAnalysis(score, mock.totalMarks, weakTopicsList, timeTaken);

  // Save Attempt
  return await prisma.mockTestAttempt.create({
    data: {
      userId: parseInt(userId),
      mockTestId: parseInt(mockTestId),
      score,
      correctCount: correct,
      wrongCount: wrong,
      skippedCount: mock.questions.length - (correct + wrong),
      timeTaken,
      analysisJson: aiAnalysis || {}, 
      aiFeedback: aiAnalysis?.summary || "Keep practicing!",
      answers: {
        create: attemptData
      }
    }
  });
};