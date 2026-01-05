import prisma from "../../lib/prisma.js";
import * as aiService from "../../services/aiService.js";

// =========================================================
// 1. EXAM TAKING CORE (Start -> Heartbeat -> Finish)
// =========================================================

/**
 * Step 1: Initialize OR Resume the Exam
 * FIX: Prevents restart on page refresh/back button by checking for existing attempts.
 */
export const startExamSession = async (userId, mockTestId) => {
  // 1. Check if the user has an existing attempt for this exam
  const existingAttempt = await prisma.mockTestAttempt.findFirst({
    where: {
      userId: parseInt(userId),
      mockTestId: parseInt(mockTestId),
    },
    orderBy: { createdAt: "desc" }, // Always get the latest attempt
  });

  if (existingAttempt) {
    // A. If the exam is already COMPLETED, return it.
    // The Frontend must check 'status' === 'COMPLETED' and redirect to /analysis.
    if (existingAttempt.status === "COMPLETED") {
      return existingAttempt;
    }

    // B. If the exam is IN_PROGRESS, return it.
    // The Frontend will use 'timeTaken' and 'answers' to resume the state.
    return existingAttempt;
  }

  // 2. Only create a NEW session if no previous attempt exists
  const attempt = await prisma.mockTestAttempt.create({
    data: {
      userId: parseInt(userId),
      mockTestId: parseInt(mockTestId),
      status: "IN_PROGRESS",
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      timeTaken: 0,
      warningCount: 0,
    },
  });

  return attempt;
};

/**
 * Step 2: Periodic Heartbeat
 * Syncs progress without overwriting if exam is finished.
 */
export const saveHeartbeat = async (
  attemptId,
  userId,
  answers,
  timeTaken,
  warningCount
) => {
  const attempt = await prisma.mockTestAttempt.findUnique({
    where: { id: attemptId },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new Error("Invalid attempt session.");
  }

  // Prevent updates if exam is already submitted
  if (attempt.status === "COMPLETED") {
    return { lastHeartbeat: new Date(), status: "COMPLETED" };
  }

  // Update session metadata
  await prisma.mockTestAttempt.update({
    where: { id: attemptId },
    data: {
      timeTaken: timeTaken !== undefined ? timeTaken : attempt.timeTaken,
      warningCount: warningCount !== undefined ? warningCount : attempt.warningCount,
      lastHeartbeat: new Date(),
    },
  });

  // Bulk Upsert Answers (Efficient)
  if (answers && answers.length > 0) {
    const ops = answers
      .map((ans) => {
        if (ans.selectedOption === null || ans.selectedOption === undefined)
          return null;

        return prisma.mockTestAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attemptId,
              questionId: ans.questionId,
            },
          },
          create: {
            attemptId: attemptId,
            questionId: ans.questionId,
            selectedOption: ans.selectedOption,
            timeTaken: ans.timeTaken || 0,
            isCorrect: false,
          },
          update: {
            selectedOption: ans.selectedOption,
            timeTaken: ans.timeTaken || 0,
          },
        });
      })
      .filter((op) => op !== null);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }
  }

  return { lastHeartbeat: new Date(), status: "IN_PROGRESS" };
};

/**
 * Step 3: Final Submission & Analytics
 * Handles scoring, percentile calculation, and AI Analysis.
 */
export const finalizeExam = async (
  attemptId,
  userId,
  finalAnswers,
  totalTime,
  warningCount
) => {
  // 1. Save final state first
  await saveHeartbeat(attemptId, userId, finalAnswers, totalTime, warningCount);

  // 2. Fetch full attempt with Question details for scoring
  const attempt = await prisma.mockTestAttempt.findUnique({
    where: { id: attemptId },
    include: {
      mockTest: {
        include: {
          questions: {
            include: {
              question: { include: { topic: true } },
            },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) throw new Error("Attempt not found");

  // 3. IDEMPOTENCY CHECK: If already completed, return existing result.
  // This prevents double submission errors if user clicks twice or refreshes.
  if (attempt.status === "COMPLETED") {
    return await prisma.mockTestAttempt.findUnique({
      where: { id: attemptId },
      include: {
        mockTest: {
          include: {
            questions: {
              include: { question: true },
              orderBy: { id: "asc" },
            },
          },
        },
        answers: { orderBy: { questionId: "asc" } },
      },
    });
  }

  const mock = attempt.mockTest;
  const userAnswersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const topicStats = {};

  // 4. Calculate Score
  for (const mockQ of mock.questions) {
    const qId = mockQ.questionId;
    const qTopic = mockQ.question.topic?.name || "General";

    if (!topicStats[qTopic]) topicStats[qTopic] = { total: 0, correct: 0 };
    topicStats[qTopic].total++;

    const userAns = userAnswersMap.get(qId);

    if (
      !userAns ||
      userAns.selectedOption === null ||
      userAns.selectedOption === undefined
    ) {
      skipped++;
      continue;
    }

    const isCorrect = userAns.selectedOption === mockQ.question.correctIndex;

    // Mark answer as correct/incorrect in DB
    await prisma.mockTestAnswer.update({
      where: { id: userAns.id },
      data: { isCorrect },
    });

    if (isCorrect) {
      score += mockQ.marks;
      correct++;
      topicStats[qTopic].correct++;
    } else {
      score -= mockQ.negative;
      wrong++;
    }
  }

  // 5. Calculate Percentile
  const totalAttempts = await prisma.mockTestAttempt.count({
    where: { mockTestId: mock.id, status: "COMPLETED" },
  });

  const attemptsBelow = await prisma.mockTestAttempt.count({
    where: {
      mockTestId: mock.id,
      status: "COMPLETED",
      score: { lt: score },
    },
  });

  // (totalAttempts + 1) because the current attempt is about to be completed
  const currentTotal = totalAttempts + 1;
  const percentile =
    currentTotal > 1
      ? parseFloat(((attemptsBelow / currentTotal) * 100).toFixed(2))
      : 100.0;

  // 6. Generate Topic Analysis
  const topicHeatmap = {};
  for (const [topic, stats] of Object.entries(topicStats)) {
    topicHeatmap[topic] =
      stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  }

  const weakTopics = Object.entries(topicHeatmap)
    .filter(([_, pct]) => pct < 50)
    .map(([topic]) => topic);

  // 7. Generate AI Feedback (Async)
  const aiAnalysis = await aiService.generateExamAnalysis(
    score,
    mock.totalMarks,
    weakTopics,
    attempt.timeTaken
  );

  // 8. Update Final Status
  const finalResult = await prisma.mockTestAttempt.update({
    where: { id: attemptId },
    data: {
      status: "COMPLETED",
      submittedAt: new Date(),
      score,
      correctCount: correct,
      wrongCount: wrong,
      skippedCount: skipped,
      percentile,
      topicAnalysis: topicHeatmap,
      analysisJson: aiAnalysis || {},
      aiFeedback: aiAnalysis?.summary || "Well done!",
    },
    include: {
      mockTest: {
        include: {
          questions: {
            include: { question: true },
            orderBy: { id: "asc" },
          },
        },
      },
      answers: {
        orderBy: { questionId: "asc" },
      },
    },
  });

  return finalResult;
};


// =========================================================
// 2. CONTENT MANAGEMENT & GENERATION (Admin)
// =========================================================

export const processPreviousYearPaper = async (
  textData,
  courseId,
  year,
  sourceName
) => {
  const extractedQuestions = await aiService.parseQuestionsFromText(
    textData,
    sourceName
  );

  const createdCount = await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: parseInt(courseId) },
      include: {
        subjects: {
          include: { subject: { include: { topics: true } } },
        },
      },
    });

    const subjectTopicMap = new Map();
    const allValidTopicIds = [];

    if (course && course.subjects.length > 0) {
      course.subjects.forEach((cs) => {
        const subjName = cs.subject.name.toLowerCase();
        const defaultTopic = cs.subject.topics[0];
        if (defaultTopic) {
          subjectTopicMap.set(subjName, defaultTopic.id);
          allValidTopicIds.push(defaultTopic.id);
        }
      });
    }

    let globalFallbackId = null;
    if (allValidTopicIds.length === 0) {
      const anyTopic = await tx.topic.findFirst();
      if (!anyTopic) throw new Error("System Error: No topics exist in DB.");
      globalFallbackId = anyTopic.id;
    }

    const questionsData = extractedQuestions.map((q) => {
      let targetTopicId = globalFallbackId;

      if (!targetTopicId && allValidTopicIds.length > 0) {
        const aiSubject = (q.subject || "").toLowerCase();
        for (const [name, id] of subjectTopicMap.entries()) {
          if (aiSubject.includes(name) || name.includes(aiSubject)) {
            targetTopicId = id;
            break;
          }
        }
        if (!targetTopicId) {
          const randomIndex = Math.floor(
            Math.random() * allValidTopicIds.length
          );
          targetTopicId = allValidTopicIds[randomIndex];
        }
      }

      return {
        questionText: q.questionText,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        type: "MCQ",
        difficulty: q.difficulty ? q.difficulty.toUpperCase() : "MEDIUM",
        topicId: targetTopicId,
      };
    });

    await tx.questionBank.createMany({ data: questionsData });
    return questionsData.length;
  });

  return { message: `Successfully imported ${createdCount} questions.` };
};

/**
 * [UPDATED] Enterprise-Grade Mock Generator (Sequential Processing)
 */
export const generateMockExam = async (
  courseId,
  title,
  useAI = false,
  examType = "FULL_MOCK",
  subjectId = null
) => {
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: {
      subjects: { include: { subject: { include: { topics: true } } } },
    },
  });

  if (!course || course.subjects.length === 0) {
    throw new Error("Course or Syllabus missing.");
  }

  // Filter subjects
  let targetSubjects = course.subjects;
  if (examType === "SECTIONAL" && subjectId) {
    targetSubjects = course.subjects.filter(
      (s) => s.subjectId === parseInt(subjectId)
    );
    if (targetSubjects.length === 0)
      throw new Error("Selected subject not in syllabus.");
  }

  // 1. Create the Shell Exam first
  const mockTest = await prisma.mockTest.create({
    data: {
      title: title,
      courseId: course.id,
      examType: examType,
      subjectId: subjectId ? parseInt(subjectId) : null,
      durationMin: examType === "SECTIONAL" ? 30 : 60,
      totalMarks: 0,
      isLive: false, // Hidden until generation is complete
    },
  });

  // 2. Sequential Subject Processing (More stable than Promise.all)
  // We process one subject at a time to prevent AI Rate Limits.
  const allMockQuestions = [];

  for (const config of targetSubjects) {
    const subjectName = config.subject.name;
    const countNeeded = config.questionCount;
    let questionsToAdd = [];

    // --- FIX STARTS: RESOLVE VALID TOPIC ID ---
    let targetTopicId = null;
    if (config.subject.topics && config.subject.topics.length > 0) {
      // Use the first available topic for this subject
      targetTopicId = config.subject.topics[0].id;
    } else {
      // Fallback: Check if a "General" topic exists for this subject, or create it.
      // This is crucial because QuestionBank requires a valid topicId, NOT a subjectId.
      const existingTopic = await prisma.topic.findFirst({
        where: { subjectId: config.subjectId },
      });

      if (existingTopic) {
        targetTopicId = existingTopic.id;
      } else {
        const newTopic = await prisma.topic.create({
          data: {
            name: "General",
            subjectId: config.subjectId,
          },
        });
        targetTopicId = newTopic.id;
      }
    }
    // --- FIX ENDS ---

    console.log(`[ExamGen] Processing subject: ${subjectName}...`);

    const isCurrentAffairs = subjectName.toLowerCase().includes("current affairs");

    if (isCurrentAffairs) {
      // Strategy A: Current Affairs (Pure AI Generation)
      const generatedQs = await aiService.generateQuestionsFromSyllabus(
        course.name,
        "Current Affairs",
        countNeeded
      );
      
      // Save generated questions immediately
      for (const gq of generatedQs) {
         const savedQ = await prisma.questionBank.create({
            data: {
              questionText: gq.questionText,
              options: gq.options,
              correctIndex: gq.correctIndex,
              explanation: gq.explanation,
              topicId: targetTopicId, // Use the resolved Topic ID
              difficulty: "MEDIUM",
            },
         });
         questionsToAdd.push(savedQ);
      }
    } else {
      // Strategy B: Database First, then AI Fill
      if (!useAI) {
        questionsToAdd = await prisma.questionBank.findMany({
          where: { topic: { subjectId: config.subjectId } },
          take: countNeeded,
        });
      }

      if (questionsToAdd.length < countNeeded) {
        const deficit = countNeeded - questionsToAdd.length;
        console.log(`[ExamGen] Deficit for ${subjectName}: ${deficit}. Generating...`);
        
        const generatedQs = await aiService.generateQuestionsFromSyllabus(
          course.name,
          subjectName,
          deficit
        );

        for (const gq of generatedQs) {
           const savedQ = await prisma.questionBank.create({
             data: {
               questionText: gq.questionText,
               options: gq.options,
               correctIndex: gq.correctIndex,
               explanation: gq.explanation,
               topicId: targetTopicId, // Use the resolved Topic ID
               difficulty: "MEDIUM",
             },
           });
           questionsToAdd.push(savedQ);
        }
      }
    }

    // Map to MockTestQuestion format
    const mappedQs = questionsToAdd.map((q) => ({
      mockTestId: mockTest.id,
      questionId: q.id,
      marks: config.marksPerQ,
      negative: config.negativeMarks,
    }));

    allMockQuestions.push(...mappedQs);
  }

  if (allMockQuestions.length === 0) {
    await prisma.mockTest.delete({ where: { id: mockTest.id } });
    throw new Error("Generation Failed: No questions could be gathered.");
  }

  // Bulk Insert Links
  await prisma.mockTestQuestion.createMany({ data: allMockQuestions });

  const grandTotalMarks = allMockQuestions.reduce(
    (sum, item) => sum + item.marks,
    0
  );

  // 3. Mark Exam as Live
  const finalMock = await prisma.mockTest.update({
    where: { id: mockTest.id },
    data: { totalMarks: grandTotalMarks, isLive: true },
  });

  return finalMock;
};

export const getMockTestsForCourse = async (courseId) => {
  return await prisma.mockTest.findMany({
    where: { courseId: parseInt(courseId), isLive: true },
    select: {
      id: true,
      title: true,
      examType: true, // IMPORTANT: Return this so frontend can filter
      durationMin: true,
      totalMarks: true,
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getMockTestById = async (id) => {
  return await prisma.mockTest.findUnique({
    where: { id: parseInt(id) },
    include: {
      questions: {
        include: {
          question: {
            select: {
              id: true,
              questionText: true,
              options: true,
              type: true,
            },
          },
        },
        orderBy: { id: "asc" }, // Consistent ordering
      },
    },
  });
};

export const getUserExamHistory = async (userId) => {
  return await prisma.mockTestAttempt.findMany({
    where: { userId: parseInt(userId) },
    include: {
      mockTest: {
        select: {
          title: true,
          totalMarks: true,
          durationMin: true,
          course: { select: { name: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
};