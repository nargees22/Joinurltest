import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../service/supabase';
import { PageLoader } from '../components/PageLoader';
import { TimerCircle } from '../components/TimerCircle';
import { SurveyResultsChart } from '../components/SurveyResultsChart';
import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';
import Button from '../components/Button';
import { GameState, QuestionType } from '../../types';

const QuizHostPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  // ---------------- STATE ----------------
  const [quiz, setQuiz] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------- FETCH DATA ----------------
  useEffect(() => {
    if (!quizId) return;

    const load = async () => {
      setLoading(true);

      const { data: quizRow } = await supabase
        .from('quiz_master_structure')
        .select('*')
        .eq('quiz_id', quizId)
        .single();

      const { data: questionRows } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('question_order');

      const { data: playerRows } = await supabase
        .from('quiz_players')
        .select('*')
        .eq('quiz_id', quizId);

      if (!quizRow || !questionRows) {
        setLoading(false);
        return;
      }

      setQuiz({
        id: quizRow.quiz_id,
        title: quizRow.title,
        gameState: quizRow.game_state,
        currentIndex: quizRow.current_question_index ?? 0,
        questions: questionRows.map((q: any) => ({
          text: q.question_text,
          options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
          timeLimit: q.time_limit ?? 30,
          type: q.type ?? QuestionType.MCQ,
        })),
      });

      setPlayers(playerRows ?? []);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`host-${quizId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_master_structure', filter: `quiz_id=eq.${quizId}` },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  // ---------------- CURRENT QUESTION ----------------
  const question =
    quiz &&
    quiz.questions &&
    quiz.currentIndex >= 0 &&
    quiz.currentIndex < quiz.questions.length
      ? quiz.questions[quiz.currentIndex]
      : null;

  // ---------------- ANSWER COUNTS ----------------
  const answerCounts = useMemo(() => {
    if (!question) return [];
    const counts = new Array(question.options.length).fill(0);
    answers.forEach(a => {
      if (typeof a.answer === 'number') counts[a.answer]++;
    });
    return counts;
  }, [answers, question]);

  // ---------------- GAME STATE UPDATE ----------------
  const updateGameState = async (next: GameState) => {
    if (!quizId) return;

    await supabase
      .from('quiz_master_structure')
      .update({
        game_state: next,
        current_question_index:
          next === GameState.QUESTION_INTRO && quiz.gameState === GameState.LEADERBOARD
            ? quiz.currentIndex + 1
            : quiz.currentIndex,
      })
      .eq('quiz_id', quizId);
  };

  // ---------------- RENDER ----------------
  if (loading) {
    return <PageLoader message="Loading host view..." />;
  }

  if (!quizId || !quiz) {
    return <PageLoader message="Invalid quiz" />;
  }

  return (
    <div className="p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">{quiz.title}</h1>

      {quiz.gameState === GameState.QUESTION_INTRO && question && (
        <>
          <TimerCircle duration={question.timeLimit} start />
          <h2 className="text-xl mt-6">{question.text}</h2>
        </>
      )}

      {quiz.gameState === GameState.QUESTION_RESULT && question && (
        <SurveyResultsChart options={question.options} answerCounts={answerCounts} />
      )}

      {quiz.gameState === GameState.LEADERBOARD && (
        <IntermediateLeaderboard players={players} quiz={quiz} animate />
      )}

      <div className="mt-8 flex gap-4">
        {quiz.gameState === GameState.LOBBY && (
          <Button onClick={() => updateGameState(GameState.QUESTION_INTRO)}>Start Quiz</Button>
        )}

        {quiz.gameState === GameState.QUESTION_RESULT && (
          <Button onClick={() => updateGameState(GameState.LEADERBOARD)}>Leaderboard</Button>
        )}
      </div>
    </div>
  );
};

export default QuizHostPage;
    