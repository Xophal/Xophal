import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Question, TestResponse, MockTest } from "@/types";
import { getAttemptExpiresAt, getRemainingSeconds } from "@/lib/test-timer";

interface TestState {
  attemptId: string | null;
  mockTest: MockTest | null;
  questions: Question[];
  currentIndex: number;
  responses: Record<string, TestResponse>;
  timeRemaining: number;
  expiresAt: number | null;
  startedAt: number | null;
  isFullscreen: boolean;
  isPaused: boolean;
  isSubmitted: boolean;
  isExpired: boolean;

  setAttempt: (attemptId: string, mockTest: MockTest, questions: Question[], startedAt?: number) => void;
  setCurrentIndex: (index: number) => void;
  saveResponse: (questionId: string, response: Partial<TestResponse>) => void;
  clearAnswer: (questionId: string) => void;
  toggleBookmark: (questionId: string) => void;
  toggleReviewLater: (questionId: string) => void;
  markVisited: (questionId: string) => void;
  setTimeRemaining: (seconds: number) => void;
  toggleFullscreen: () => void;
  togglePause: () => void;
  submitTest: () => void;
  expireTest: () => void;
  resetTest: () => void;

  getAnsweredCount: () => number;
  getBookmarkedCount: () => number;
  getReviewLaterCount: () => number;
}

export const useTestStore = create<TestState>()(
  persist(
    (set, get) => ({
      attemptId: null,
      mockTest: null,
      questions: [],
      currentIndex: 0,
      responses: {},
      timeRemaining: 0,
      expiresAt: null,
      startedAt: null,
      isFullscreen: false,
      isPaused: false,
      isSubmitted: false,
      isExpired: false,

      setAttempt: (attemptId, mockTest, questions, startedAt = Date.now()) =>
        set((state) => {
          const isSameAttempt = state.attemptId === attemptId;
          const existingExpiresAt = state.expiresAt;

          if (isSameAttempt && existingExpiresAt) {
            const remainingSeconds = getRemainingSeconds(existingExpiresAt);
            return {
              ...state,
              mockTest,
              questions,
              timeRemaining: remainingSeconds,
              isSubmitted: state.isSubmitted || remainingSeconds === 0,
              isExpired: state.isExpired || remainingSeconds === 0,
            };
          }

          const expiresAt = getAttemptExpiresAt(startedAt, mockTest.duration_minutes);
          return {
            attemptId,
            mockTest,
            questions,
            currentIndex: 0,
            responses: {},
            timeRemaining: getRemainingSeconds(expiresAt),
            expiresAt,
            startedAt,
            isSubmitted: false,
            isExpired: false,
          };
        }),

      setCurrentIndex: (index) => set((state) => ({ currentIndex: Math.max(0, Math.min(index, state.questions.length - 1)) })),

      saveResponse: (questionId, response) =>
        set((state) => ({
          responses: {
            ...state.responses,
            [questionId]: {
              ...state.responses[questionId],
              question_id: questionId,
              ...response,
            } as TestResponse,
          },
        })),

      clearAnswer: (questionId) =>
        set((state) => {
          const existing = state.responses[questionId];
          if (!existing) return state;
          return {
            responses: {
              ...state.responses,
              [questionId]: {
                ...existing,
                selected_option_ids: [],
                text_answer: null,
                numerical_answer: null,
              },
            },
          };
        }),

      toggleBookmark: (questionId) =>
        set((state) => ({
          responses: {
            ...state.responses,
            [questionId]: {
              ...state.responses[questionId],
              question_id: questionId,
              is_bookmarked: !state.responses[questionId]?.is_bookmarked,
            } as TestResponse,
          },
        })),

      toggleReviewLater: (questionId) =>
        set((state) => ({
          responses: {
            ...state.responses,
            [questionId]: {
              ...state.responses[questionId],
              question_id: questionId,
              is_review_later: !state.responses[questionId]?.is_review_later,
            } as TestResponse,
          },
        })),

      markVisited: (questionId) =>
        set((state) => ({
          responses: {
            ...state.responses,
            [questionId]: {
              ...state.responses[questionId],
              question_id: questionId,
              is_visited: true,
            } as TestResponse,
          },
        })),

      setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),
      toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
      togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
      submitTest: () => set({ isSubmitted: true, isExpired: false }),
      expireTest: () => set({ isSubmitted: true, isExpired: true, timeRemaining: 0 }),
      resetTest: () =>
        set({
          attemptId: null,
          mockTest: null,
          questions: [],
          currentIndex: 0,
          responses: {},
          timeRemaining: 0,
          expiresAt: null,
          startedAt: null,
          isFullscreen: false,
          isPaused: false,
          isSubmitted: false,
          isExpired: false,
        }),

      getAnsweredCount: () => {
        const { responses } = get();
        return Object.values(responses).filter(
          (r) => r.selected_option_ids?.length || r.text_answer || r.numerical_answer != null
        ).length;
      },

      getBookmarkedCount: () => {
        const { responses } = get();
        return Object.values(responses).filter((r) => r.is_bookmarked).length;
      },

      getReviewLaterCount: () => {
        const { responses } = get();
        return Object.values(responses).filter((r) => r.is_review_later).length;
      },
    }),
    {
      name: "xophal-test",
      partialize: (state) => ({
        attemptId: state.attemptId,
        mockTest: state.mockTest,
        questions: state.questions,
        currentIndex: state.currentIndex,
        responses: state.responses,
        timeRemaining: state.timeRemaining,
        expiresAt: state.expiresAt,
        startedAt: state.startedAt,
        isSubmitted: state.isSubmitted,
        isExpired: state.isExpired,
      }),
    }
  )
);

interface AppState {
  sidebarOpen: boolean;
  selectedBoardId: string | null;
  selectedClassId: string | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedBoard: (boardId: string | null) => void;
  setSelectedClass: (classId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  selectedBoardId: null,
  selectedClassId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSelectedBoard: (boardId) => set({ selectedBoardId: boardId }),
  setSelectedClass: (classId) => set({ selectedClassId: classId }),
}));
