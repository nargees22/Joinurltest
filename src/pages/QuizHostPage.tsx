import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../service/supabase';
import { PageLoader } from '../components/PageLoader';
import { TimerCircle } from '../components/TimerCircle';
import { SurveyResultsChart } from '../components/SurveyResultsChart';
import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';
import Button from '../components/Button';
import { GameState, QuestionType } from '../../types';

const QuizHostPage = () => {
  const { quizId } = useParams<{ quizId: string }>();

  const [quiz, setQuiz] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // LOAD QUIZ DATA
  // --------------------------------------------------
  const loadQuiz = async () => {
    if (!quizId) return;

    setLoading(true);

    const [{ data: quizRow }, { data: questionRows }, { data: playerRows }] =
      await Promise.all([
        supabase
          .from('quiz_master_structure')
          .select('*')
          .eq('quiz_id', quizId)
          .single(),

        supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', quizId)
          .order('question_order'),

        supabase
          .from('quiz_players')
          .select('*')
          .eq('quiz_id', quizId),
      ]);

    if (!quizRow || !questionRows) {
      setLoading(false);
      return;
    }

    setQuiz({
      id: quizRow.quiz_id,
      title: quizRow.title,
      gameState: quizRow.game_state,
      currentIndex: quizRow.current_question_index ?? 0,
      showQuestionToPlayers: quizRow.show_question_to_players,
      questions: questionRows.map((q: any) => ({
        text: q.question_text,
        options: [
          q.option_1,
          q.option_2,
          q.option_3,
          q.option_4,
        ].filter(Boolean),
        correctAnswerIndex: q.correct_answer_index,
        timeLimit: q.time_limit ?? 30, // SECONDS
        type: q.type ?? QuestionType.MCQ,
      })),
    });

    setPlayers(playerRows ?? []);
    setLoading(false);
  };

  // --------------------------------------------------
  // REALTIME: QUIZ STATE
  // --------------------------------------------------
  useEffect(() => {
    if (!quizId) return;

    loadQuiz();

    const channel = supabase
      .channel(`host-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_master_structure',
          filter: `quiz_id=eq.${quizId}`,
        },
        () => loadQuiz()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  // --------------------------------------------------
  // REALTIME: PLAYER ANSWERS
  // --------------------------------------------------
  useEffect(() => {
    if (!quizId) return;

    const channel = supabase
      .channel(`answers-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quiz_answers',
          filter: `quiz_id=eq.${quizId}`,
        },
        payload => {
          setAnswers(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  // --------------------------------------------------
  // CURRENT QUESTION
  // --------------------------------------------------
  const question =
    quiz &&
    quiz.questions &&
    quiz.currentIndex >= 0 &&
    quiz.currentIndex < quiz.questions.length
      ? quiz.questions[quiz.currentIndex]
      : null;

  // --------------------------------------------------
  // ANSWER COUNTS
  // --------------------------------------------------
  const answerCounts = useMemo(() => {
    if (!question) return [];
    const counts = new Array(question.options.length).fill(0);
    answers.forEach(a => {
      if (typeof a.answer === 'number') {
        counts[a.answer]++;
      }
    });
    return counts;
  }, [answers, question]);

  // --------------------------------------------------
  // GAME STATE UPDATES
  // --------------------------------------------------
  const updateGameState = async (next: GameState) => {
    if (!quizId || !quiz) return;

    setAnswers([]);

    await supabase
      .from('quiz_master_structure')
      .update({
        game_state: next,
        show_question_to_players:
          next === GameState.QUESTION_ACTIVE,
        current_question_index:
          next === GameState.QUESTION_INTRO &&
          quiz.gameState === GameState.LEADERBOARD
            ? quiz.currentIndex + 1
            : quiz.currentIndex,
      })
      .eq('quiz_id', quizId);
  };

  // --------------------------------------------------
  // DEBUGGING: TIMER AND GAME STATE
  // --------------------------------------------------
  useEffect(() => {
    if (quiz) {
      console.log('Current gameState:', quiz.gameState);
      console.log('Current question index:', quiz.currentIndex);
      console.log('Current question time limit:', question?.timeLimit);
    } else {
      console.log('Quiz object is null or undefined.');
    }
  }, [quiz, question]);

  // --------------------------------------------------
  // DEBUGGING: ANSWERS AND RESULTS
  // --------------------------------------------------
  useEffect(() => {
    if (quiz.gameState === GameState.QUESTION_RESULT) {
      console.log('Answers for current question:', answers);
      console.log('Answer counts:', answerCounts);
    }
  }, [quiz.gameState, answers, answerCounts]);

  // --------------------------------------------------
  // TIMER FUNCTIONALITY
  // --------------------------------------------------
  const TimerCircleWrapper = () => {
    if (quiz.gameState === GameState.QUESTION_ACTIVE && question) {
      return (
        <div className="mt-6 flex justify-center">
          <TimerCircle duration={question.timeLimit} start />
        </div>
      );
    }
    return null;
  };

  // --------------------------------------------------
  // STYLED BUTTON: SHOW RESULTS
  // --------------------------------------------------
  const StyledButton = ({ onClick, children, isActive }: any) => {
    return (
      <Button
        onClick={onClick}
        className={`p-4 rounded-lg font-bold text-white w-full md:w-auto ${
          isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'
        }`}
      >
        {children}
      </Button>
    );
  };

  // --------------------------------------------------
  // GUARDS
  // --------------------------------------------------
  if (loading) return <PageLoader message="Loading host view..." />;
  if (!quizId || !quiz) return <PageLoader message="Invalid quiz" />;

  // --------------------------------------------------
  // UI: UPDATED CONTROLS
  // --------------------------------------------------
  return (
    <div className="p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">{quiz.title}</h1>

      {/* QUESTION */}
      {question && (
        <div className="w-full max-w-3xl mb-8">
          <h2 className="text-xl font-bold mb-6 text-center">
            {question.text}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.options.map((opt: string, index: number) => (
              <div
                key={index}
                className="p-4 bg-slate-200 rounded-lg text-center font-semibold"
              >
                {opt}
              </div>
            ))}
          </div>

          TIMER
          <TimerCircleWrapper />
        </div>
      )}

      {/* RESULTS */}
      {quiz.gameState === GameState.QUESTION_RESULT && question && (
        <div className="w-full max-w-3xl mb-8">
          <h2 className="text-xl font-bold mb-6 text-center">
            Results for: {question.text}
          </h2>
          <SurveyResultsChart
            options={question.options}
            answerCounts={answerCounts}
          />
        </div>
      )}

      {/* LEADERBOARD */}
      {quiz.gameState === GameState.LEADERBOARD && (
        <IntermediateLeaderboard players={players} quiz={quiz} animate />
      )}

      {/* CONTROLS */}
      <div className="mt-8 flex gap-4">
        {quiz.gameState === GameState.QUESTION_INTRO && (
          <StyledButton
            onClick={() => updateGameState(GameState.QUESTION_ACTIVE)}
            isActive={true}
          >
            Start Question (Show to Players)
          </StyledButton>
        )}

        {quiz.gameState === GameState.QUESTION_ACTIVE && (
          <StyledButton
            onClick={() => updateGameState(GameState.QUESTION_RESULT)}
            isActive={true}
          >
            Show Results
          </StyledButton>
        )}

        {quiz.gameState === GameState.QUESTION_RESULT && (
          <StyledButton
            onClick={() => updateGameState(GameState.LEADERBOARD)}
            isActive={true}
          >
            Show Leaderboard
          </StyledButton>
        )}

        {/* ADDITIONAL BUTTON: NEXT QUESTION */}
        {quiz.gameState === GameState.LEADERBOARD && (
          <StyledButton
            onClick={() => {
              if (quiz.currentIndex + 1 < quiz.questions.length) {
                updateGameState(GameState.QUESTION_INTRO);
              } else {
                alert('Quiz completed!');
              }
            }}
            isActive={true}
          >
            Next Question
          </StyledButton>
        )}
      </div>
    </div>
  );
};

export default QuizHostPage;
