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

  // ---------------------------------------------
  // LOAD QUIZ
  // ---------------------------------------------
  const loadQuiz = async () => {
    if (!quizId) return;

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

    if (!quizRow || !questionRows) return;

    setQuiz({
      id: quizRow.quiz_id,
      title: quizRow.title,
      gameState: quizRow.game_state,
      currentIndex: quizRow.current_question_index ?? 0,
      questions: questionRows.map((q: any) => ({
        id: q.pk_id,
        text: q.question_text,
        options: [
          q.option_1,
          q.option_2,
          q.option_3,
          q.option_4,
        ].filter(Boolean),
        correctAnswerIndex: q.correct_answer_index,
        timeLimit: q.time_limit ?? 30,
        type: q.type ?? QuestionType.MCQ,
      })),
    });

    setPlayers(playerRows ?? []);
    setLoading(false);
  };

  // ---------------------------------------------
  // REALTIME LISTENERS
  // ---------------------------------------------
  useEffect(() => {
    if (!quizId) return;

    loadQuiz();

    const quizChannel = supabase
      .channel(`quiz-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_master_structure',
          filter: `quiz_id=eq.${quizId}`,
        },
        loadQuiz
      )
      .subscribe();

    const answersChannel = supabase
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
      supabase.removeChannel(quizChannel);
      supabase.removeChannel(answersChannel);
    };
  }, [quizId]);

  // ---------------------------------------------
  // CURRENT QUESTION
  // ---------------------------------------------
  const question =
    quiz?.questions?.[quiz.currentIndex] ?? null;

  // ---------------------------------------------
  // ANSWER COUNTS
  // ---------------------------------------------
  const answerCounts = useMemo(() => {
    if (!question) return [];
    const counts = new Array(question.options.length).fill(0);

    answers
      .filter(a => a.question_id === question.id)
      .forEach(a => {
        if (typeof a.answer === 'number') {
          counts[a.answer]++;
        }
      });

    return counts;
  }, [answers, question]);

  // ---------------------------------------------
  // GAME STATE UPDATE
  // ---------------------------------------------
  const updateGameState = async (next: GameState) => {
    if (!quizId || !quiz) return;

    setAnswers([]);

    await supabase
      .from('quiz_master_structure')
      .update({
        game_state: next,
        current_question_index:
          next === GameState.QUESTION_ACTIVE &&
          quiz.gameState === GameState.LEADERBOARD
            ? quiz.currentIndex + 1
            : quiz.currentIndex,
      })
      .eq('quiz_id', quizId);
  };

  // ---------------------------------------------
  // GUARDS
  // ---------------------------------------------
  if (loading) return <PageLoader message="Loading host view..." />;
  if (!quiz) return <PageLoader message="Invalid quiz" />;

  // ---------------------------------------------
  // UI
  // ---------------------------------------------
  return (
    <div className="p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">{quiz.title}</h1>

      {/* LOBBY */}
      {quiz.gameState === GameState.LOBBY && (
        <>
          <p className="mb-6 text-lg">Waiting for players to join…</p>
          <Button onClick={() => updateGameState(GameState.QUESTION_ACTIVE)}>
            Start Quiz
          </Button>
        </>
      )}

      {/* QUESTION */}
      {quiz.gameState === GameState.QUESTION_ACTIVE && question && (
        <div className="w-full max-w-3xl">
          <h2 className="text-xl font-bold mb-6 text-center">
            {question.text}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.options.map((opt, index) => (
              <div
                key={index}
                className="p-4 bg-slate-200 rounded-lg text-center font-semibold"
              >
                {opt}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <TimerCircle
              duration={question.timeLimit}
              start
              onComplete={() =>
                updateGameState(GameState.QUESTION_RESULT)
              }
            />
          </div>

         {quiz.gameState === GameState.QUESTION_ACTIVE && (
  <div className="mt-6">
    <Button
      onClick={() => updateGameState(GameState.QUESTION_RESULT)}
      disabled={false}
      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg"
    >
      Show Results
    </Button>
  </div>
)}

      

      {/* RESULTS */}
      {quiz.gameState === GameState.QUESTION_RESULT && question && (
        <>
          <SurveyResultsChart
            options={question.options}
            answerCounts={answerCounts}
          />
          <Button
            className="mt-6"
            onClick={() => updateGameState(GameState.LEADERBOARD)}
          >
            Show Leaderboard
          </Button>
        </>
      )}

      {/* LEADERBOARD */}
      {quiz.gameState === GameState.LEADERBOARD && (
        <>
          <IntermediateLeaderboard players={players} quiz={quiz} animate />
          <Button
            className="mt-6"
            onClick={() =>
              quiz.currentIndex + 1 < quiz.questions.length
                ? updateGameState(GameState.QUESTION_ACTIVE)
                : updateGameState(GameState.FINISHED)
            }
          >
            Next Question
          </Button>
        </>
      )}
    </div>
  );
};

export default QuizHostPage;
