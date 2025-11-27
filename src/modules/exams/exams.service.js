import prisma from "../../lib/prisma.js";
import * as aiService from "../../services/aiService.js";

/**
 * Process an uploaded PYQ PDF/Text file.
 * * IMPROVED LOGIC:
 * 1. Fetches the specific subjects linked to the Course.
 * 2. Maps each AI-extracted question to the correct Subject/Topic based on keywords.
 * 3. If no match found, distributes questions randomly among the course's subjects
 * (instead of dumping them into a hidden default topic).
 */
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
    // A. Fetch Course Structure to know where to put questions
    const course = await tx.course.findUnique({
      where: { id: parseInt(courseId) },
      include: {
        subjects: {
          include: {
            subject: {
              include: { topics: true }, // Get topics to link questions to
            },
          },
        },
      },
    });

    // B. Build a Map of "Subject Name" -> "Topic ID"
    // We need valid Topic IDs that belong to THIS course.
    const subjectTopicMap = new Map(); // Key: "maths", Value: 101
    const allValidTopicIds = [];

    if (course && course.subjects.length > 0) {
      course.subjects.forEach((cs) => {
        const subjName = cs.subject.name.toLowerCase();
        // Use the first topic of the subject as the "bucket" for questions
        // If a subject has no topics, we can't store questions for it easily,
        // so admin should ensure topics exist.
        const defaultTopic = cs.subject.topics[0];
        if (defaultTopic) {
          subjectTopicMap.set(subjName, defaultTopic.id);
          allValidTopicIds.push(defaultTopic.id);
        }
      });
    }

    // C. Fallback: If Course has NO subjects configured, warn or use global default
    let globalFallbackId = null;
    if (allValidTopicIds.length === 0) {
      const anyTopic = await tx.topic.findFirst();
      if (!anyTopic)
        throw new Error(
          "System Error: No topics exist in DB. Please add Subjects & Topics in Admin first."
        );
      console.warn(
        "Warning: This course has no subjects/topics linked. Saving to global default topic."
      );
      globalFallbackId = anyTopic.id;
    }

    // D. Prepare Data with Smart Mapping
    const questionsData = extractedQuestions.map((q) => {
      let targetTopicId = globalFallbackId;

      if (!targetTopicId && allValidTopicIds.length > 0) {
        // 1. Try to match AI subject (e.g., "History") to DB Subject
        const aiSubject = (q.subject || "").toLowerCase();

        for (const [name, id] of subjectTopicMap.entries()) {
          if (aiSubject.includes(name) || name.includes(aiSubject)) {
            targetTopicId = id;
            break;
          }
        }

        // 2. If no match (e.g., AI said "Aptitude" but DB has "Maths"),
        // distribute randomly among valid course topics so they are at least reachable.
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

    // E. Bulk Insert
    await tx.questionBank.createMany({
      data: questionsData,
    });

    return questionsData.length;
  });

  return {
    message: `Successfully imported ${createdCount} questions from ${sourceName} (${year})`,
  };
};

/**
 * THE CORE EXAM GENERATOR
 * Creates a full Mock Test for a Course (e.g. SSC CGL)
 */
export const generateMockExam = async (courseId, title) => {
  // 1. Get Course Structure
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: {
      subjects: { include: { subject: true } },
    },
  });

  if (!course) throw new Error("Course not found");

  // Check if syllabus exists
  if (course.subjects.length === 0) {
    throw new Error(
      "Generation Failed: This course has no subjects linked. Go to Admin > Courses > Manage Syllabus to add subjects first."
    );
  }

  // 2. Create the Mock Test Shell
  const mockTest = await prisma.mockTest.create({
    data: {
      title: title || `${course.name} - AI Generated Mock`,
      courseId: course.id,
      durationMin: 60,
      totalMarks: 0,
      isLive: false,
    },
  });

  // 3. Process Subjects in PARALLEL
  const subjectProcessingPromises = course.subjects.map(async (config) => {
    const subjectName = config.subject.name;
    const countNeeded = config.questionCount;
    let questionsToAdd = [];

    // A. Dynamic Generation (Current Affairs)
    if (
      subjectName.toLowerCase().includes("current affairs") ||
      subjectName.toLowerCase().includes("news")
    ) {
      console.log(`Generating fresh Current Affairs for ${subjectName}...`);

      // Mock News Data (Replace with DB fetch in production)
      const recentNews = [
        {
          title: "Budget 2025",
          description: "Govt announces new tax slabs...",
        },
        { title: "Olympics 2024", description: "India wins 5 golds..." },
      ];

      const generatedQs = await aiService.generateCurrentAffairsQuestions(
        recentNews,
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
      // B. Static Bank (History, Math, etc.)

      // Try strict match first (Topic must belong to Subject)
      questionsToAdd = await prisma.questionBank.findMany({
        where: {
          topic: { subjectId: config.subjectId },
        },
        take: countNeeded,
      });

      // FALLBACK: If strict match fails (e.g., questions are in a generic topic),
      // try to find ANY questions, but we ideally want strict mapping.
      if (questionsToAdd.length < countNeeded) {
        console.warn(
          `[ExamGen] Not enough questions for ${subjectName} (Found ${questionsToAdd.length}, Needed ${countNeeded}).`
        );

        // You can enable this fallback if you want to fill the paper with *any* question
        // just to prevent failure, but it might be off-topic.
        /*
        const randomExtras = await prisma.questionBank.findMany({
          take: countNeeded - questionsToAdd.length,
          where: { id: { notIn: questionsToAdd.map(q => q.id) } }
        });
        questionsToAdd = [...questionsToAdd, ...randomExtras];
        */
      }
    }

    // Prepare connections
    return questionsToAdd.map((q) => ({
      mockTestId: mockTest.id,
      questionId: q.id,
      marks: config.marksPerQ,
      negative: config.negativeMarks,
    }));
  });

  const results = await Promise.all(subjectProcessingPromises);
  const allMockQuestions = results.flat();

  // --- CRITICAL FIX: Prevent empty exam creation ---
  if (allMockQuestions.length === 0) {
    // Delete the empty shell so it doesn't clutter the dashboard
    await prisma.mockTest.delete({ where: { id: mockTest.id } });
    throw new Error(
      "Generation Failed: No questions found for this course's subjects. Please upload a PYQ specifically for this course to populate the Question Bank."
    );
  }

  // 4. Bulk Insert Connections
  await prisma.mockTestQuestion.createMany({
    data: allMockQuestions,
  });

  // 5. Calculate Total Marks
  const grandTotalMarks = allMockQuestions.reduce(
    (sum, item) => sum + item.marks,
    0
  );

  // 6. Final Update
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

export const submitMockAttempt = async (userId, data) => {
  // 1. Destructure the payload. 
  // We now expect an object 'data' containing mockTestId, answers, warningCount, and timeTaken
  const { mockTestId, answers, warningCount, timeTaken } = data;

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
              topic: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!mock) throw new Error("Mock test not found");

  let score = 0;
  let correct = 0;
  let wrong = 0;

  const questionMap = new Map(mock.questions.map((mq) => [mq.questionId, mq]));
  const weakTopicsSet = new Set();
  const attemptData = [];

  // 2. Iterate through answers
  for (const ans of answers) {
    const mockQ = questionMap.get(ans.questionId);
    if (!mockQ) continue;

    // Note: Frontend now sends 'selectedOption', so we check that
    const selectedIndex = ans.selectedOption;

    if (selectedIndex === null || selectedIndex === undefined) {
      attemptData.push({
        questionId: ans.questionId,
        selectedOption: null,
        isCorrect: false,
        timeTaken: ans.timeTaken || 0, // Save individual question time if available
      });
      continue;
    }

    const isCorrect = mockQ.question.correctIndex === selectedIndex;

    if (isCorrect) {
      score += mockQ.marks;
      correct++;
    } else {
      score -= mockQ.negative;
      wrong++;
      if (mockQ.question.topic?.name)
        weakTopicsSet.add(mockQ.question.topic.name);
    }

    attemptData.push({
      questionId: ans.questionId,
      selectedOption: selectedIndex,
      isCorrect,
      timeTaken: ans.timeTaken || 0,
    });
  }

  // 3. Generate AI Analysis
  const aiAnalysis = await aiService.generateExamAnalysis(
    score,
    mock.totalMarks,
    Array.from(weakTopicsSet),
    timeTaken || 0
  );

  // 4. Save Attempt with Warning Count
  return await prisma.mockTestAttempt.create({
    data: {
      userId: parseInt(userId),
      mockTestId: parseInt(mockTestId),
      score,
      correctCount: correct,
      wrongCount: wrong,
      skippedCount: mock.questions.length - (correct + wrong),
      timeTaken: timeTaken || 0,       // Total exam duration from frontend
      warningCount: warningCount || 0, // <--- Security violation count
      analysisJson: aiAnalysis || {},
      aiFeedback: aiAnalysis?.summary || "Keep practicing!",
      answers: { create: attemptData },
    },
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
              // Exclude correctIndex and explanation for security
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
    where: {
      userId: parseInt(userId),
    },
    include: {
      mockTest: {
        select: {
          title: true,
          totalMarks: true,
          durationMin: true,
          course: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: {
      submittedAt: "desc",
    },
  });
};
