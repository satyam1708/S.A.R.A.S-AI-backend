import prisma from "../../lib/prisma.js";
import * as aiService from "../../services/aiService.js";

// =========================================================
// 1. EXAM TAKING CORE (Start -> Heartbeat -> Finish)
// =========================================================

/**
 * Step 1: Initialize the Exam
 * Creates the 'IN_PROGRESS' record so we can track it.
 */
export const startExamSession = async (userId, mockTestId) => {
  // Check if user already has an active attempt for this mock?
  // For now, we allow multiple attempts, but in a strict exam, you might block it.

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
 * Saves answers as they come in. If browser crashes, these are safe.
 */
export const saveHeartbeat = async (
  attemptId,
  userId,
  answers,
  timeTaken,
  warningCount
) => {
  // 1. Verify Ownership
  const attempt = await prisma.mockTestAttempt.findUnique({
    where: { id: attemptId },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new Error("Invalid attempt session.");
  }

  if (attempt.status === "COMPLETED") {
    throw new Error("Exam already submitted.");
  }

  // 2. Update Attempt Metadata
  await prisma.mockTestAttempt.update({
    where: { id: attemptId },
    data: {
      timeTaken: timeTaken || attempt.timeTaken,
      warningCount: warningCount || attempt.warningCount,
      lastHeartbeat: new Date(),
    },
  });

  // 3. Upsert Answers (Create if new, Update if changed)
  if (answers && answers.length > 0) {
    const ops = answers
      .map((ans) => {
        // Only process if an option is selected
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
            isCorrect: false, // We calculate this at the end to save performance during sync
          },
          update: {
            selectedOption: ans.selectedOption,
            timeTaken: ans.timeTaken || 0,
          },
        });
      })
      .filter((op) => op !== null); // Filter out nulls

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }
  }

  return { lastHeartbeat: new Date() };
};

/**
 * Step 3: Final Submission & Analytics
 * Calculates Score, Percentile, and Topic Analysis
 * RETURNS: Full Attempt Object with Questions & Answers for Review
 */
export const finalizeExam = async (attemptId, userId, finalAnswers, totalTime, warningCount) => {
  
  // A. Save any final pending answers first
  await saveHeartbeat(attemptId, userId, finalAnswers, totalTime, warningCount);

  // B. Fetch Full Exam Context for Calculation
  const attempt = await prisma.mockTestAttempt.findUnique({
    where: { id: attemptId },
    include: {
        mockTest: {
            include: {
                questions: {
                    include: {
                        question: { include: { topic: true } }
                    }
                }
            }
        },
        answers: true 
    }
  });

  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status === 'COMPLETED') {
      // If already completed, return the full details again (Idempotency)
      return await prisma.mockTestAttempt.findUnique({
          where: { id: attemptId },
          include: {
              mockTest: { include: { questions: { include: { question: true }, orderBy: { questionId: 'asc' } } } },
              answers: { orderBy: { questionId: 'asc' } }
          }
      });
  }

  const mock = attempt.mockTest;
  const userAnswersMap = new Map(attempt.answers.map(a => [a.questionId, a]));

  // C. Calculate Score
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const topicStats = {}; 

  // Iterate over questions
  for (const mockQ of mock.questions) {
      const qId = mockQ.questionId;
      const qTopic = mockQ.question.topic?.name || "General";
      
      if (!topicStats[qTopic]) topicStats[qTopic] = { total: 0, correct: 0 };
      topicStats[qTopic].total++;

      const userAns = userAnswersMap.get(qId);

      // Handle Skips
      if (!userAns || userAns.selectedOption === null || userAns.selectedOption === undefined) {
          skipped++;
          continue;
      }

      const isCorrect = userAns.selectedOption === mockQ.question.correctIndex;
      
      // Mark answer as correct/incorrect in DB
      await prisma.mockTestAnswer.update({
          where: { id: userAns.id },
          data: { isCorrect }
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

  // D. Calculate Percentile
  const totalAttempts = await prisma.mockTestAttempt.count({
      where: { mockTestId: mock.id, status: 'COMPLETED' }
  });
  
  const attemptsBelow = await prisma.mockTestAttempt.count({
      where: { 
          mockTestId: mock.id, 
          status: 'COMPLETED',
          score: { lt: score }
      }
  });

  const percentile = totalAttempts > 0 
      ? parseFloat(((attemptsBelow / totalAttempts) * 100).toFixed(2)) 
      : 100.00;

  // E. Format Topic Analysis
  const topicHeatmap = {};
  for (const [topic, stats] of Object.entries(topicStats)) {
      topicHeatmap[topic] = stats.total > 0 
          ? Math.round((stats.correct / stats.total) * 100) 
          : 0;
  }

  // F. Generate AI Feedback
  const weakTopics = Object.entries(topicHeatmap)
      .filter(([_, pct]) => pct < 50)
      .map(([topic]) => topic);

  const aiAnalysis = await aiService.generateExamAnalysis(
      score,
      mock.totalMarks,
      weakTopics,
      attempt.timeTaken
  );

  // G. Final Database Update & RETURN FULL DATA FOR REVIEW
  const finalResult = await prisma.mockTestAttempt.update({
      where: { id: attemptId },
      data: {
          status: 'COMPLETED',
          submittedAt: new Date(),
          score,
          correctCount: correct,
          wrongCount: wrong,
          skippedCount: skipped,
          percentile,
          topicAnalysis: topicHeatmap,
          analysisJson: aiAnalysis || {},
          aiFeedback: aiAnalysis?.summary || "Well done!"
      },
      // --- CRITICAL ADDITION FOR REVIEW PAGE ---
      include: {
          mockTest: {
              include: {
                  questions: {
                      include: {
                          question: true // Fetches text, options, explanation
                      },
                      orderBy: { orderIndex: 'asc' } // Ensure correct order
                  }
              }
          },
          answers: {
            orderBy: { questionId: 'asc' }
          }
      }
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
  // 1. AI Extraction
  const extractedQuestions = await aiService.parseQuestionsFromText(
    textData,
    sourceName
  );

  // 2. Store in DB using a Transaction
  const createdCount = await prisma.$transaction(async (tx) => {
    // Fetch Course Structure
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
 * Enhanced Mock Generator with 'useAI' flag support
 */
export const generateMockExam = async (courseId, title, useAI = false) => {
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: {
      subjects: { include: { subject: { include: { topics: true } } } },
    },
  });

  if (!course || course.subjects.length === 0) {
    throw new Error("Course or Syllabus missing.");
  }

  const mockTest = await prisma.mockTest.create({
    data: {
      title: title || `${course.name} - ${useAI ? "AI Generated" : "Standard"}`,
      courseId: course.id,
      durationMin: 60,
      totalMarks: 0,
      isLive: false,
    },
  });

  const subjectProcessingPromises = course.subjects.map(async (config) => {
    const subjectName = config.subject.name;
    const countNeeded = config.questionCount;
    let questionsToAdd = [];

    // Strategy: Current Affairs always AI, others depends on useAI flag
    const isCurrentAffairs = subjectName
      .toLowerCase()
      .includes("current affairs");

    if (isCurrentAffairs) {
      // ... (Keep existing CA logic) ...
      // Placeholder for CA logic from previous context
      const generatedQs = await aiService.generateQuestionsFromSyllabus(
        course.name,
        "Current Affairs",
        countNeeded
      );

      const savePromises = generatedQs.map((gq) =>
        prisma.questionBank.create({
          data: {
            questionText: gq.questionText,
            options: gq.options,
            correctIndex: gq.correctIndex,
            explanation: gq.explanation,
            topicId: config.subjectId,
            difficulty: "MEDIUM",
          },
        })
      );
      questionsToAdd = await Promise.all(savePromises);
    } else {
      if (!useAI) {
        questionsToAdd = await prisma.questionBank.findMany({
          where: { topic: { subjectId: config.subjectId } },
          take: countNeeded,
        });
      }

      if (questionsToAdd.length < countNeeded) {
        const deficit = countNeeded - questionsToAdd.length;
        const generatedQs = await aiService.generateQuestionsFromSyllabus(
          course.name,
          subjectName,
          deficit
        );

        const targetTopicId = config.subject.topics[0]?.id || config.subjectId;

        const savePromises = generatedQs.map((gq) =>
          prisma.questionBank.create({
            data: {
              questionText: gq.questionText,
              options: gq.options,
              correctIndex: gq.correctIndex,
              explanation: gq.explanation,
              topicId: targetTopicId,
              difficulty: "MEDIUM",
            },
          })
        );
        const newQs = await Promise.all(savePromises);
        questionsToAdd = [...questionsToAdd, ...newQs];
      }
    }

    return questionsToAdd.map((q) => ({
      mockTestId: mockTest.id,
      questionId: q.id,
      marks: config.marksPerQ,
      negative: config.negativeMarks,
    }));
  });

  const results = await Promise.all(subjectProcessingPromises);
  const allMockQuestions = results.flat();

  if (allMockQuestions.length === 0) {
    await prisma.mockTest.delete({ where: { id: mockTest.id } });
    throw new Error("Generation Failed: No questions found or generated.");
  }

  await prisma.mockTestQuestion.createMany({ data: allMockQuestions });

  const grandTotalMarks = allMockQuestions.reduce(
    (sum, item) => sum + item.marks,
    0
  );

  await prisma.mockTest.update({
    where: { id: mockTest.id },
    data: { totalMarks: grandTotalMarks, isLive: true },
  });

  return mockTest;
};

export const getMockTestsForCourse = async (courseId) => {
  return await prisma.mockTest.findMany({
    where: { courseId: parseInt(courseId), isLive: true },
    select: {
      id: true,
      title: true,
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
        orderBy: { questionId: "asc" },
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
