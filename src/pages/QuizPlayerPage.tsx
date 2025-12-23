import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../service/supabase';
import { PageLoader } from '../components/PageLoader';
import Button from '../components/Button';
import { GameState } from '../../types';

interface QuestionRow {
  pk_id: number;
  question_text: string;
  option_1?: string;
  option_2?: string;
  option_3?: string;
  option_4?: string;
  correct_answer_index?: number;
}

const QuizPlayerPage = () => {
  const { quizId } = useParams<{ quizId: string }>();

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // FETCH QUIZ + QUESTIONS (single source of truth)
  // --------------------------------------------------
  const fetchData = async () => {
    if (!quizId) return;

    setLoading(true);

    const [{ data: quizData }, { data: questionData }] = await Promise.all([
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
    ]);

    if (quizData) setQuiz(quizData);
    if (questionData) setQuestions(questionData);

    setLoading(false);
  };

  // --------------------------------------------------
  // REALTIME LISTENER (THIS FIXES REFRESH ISSUE)
  // --------------------------------------------------
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`player-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_master_structure',
          filter: `quiz_id=eq.${quizId}`,
        },
        (payload) => {
          console.log('🔄 Quiz updated:', payload.new);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  // --------------------------------------------------
  // RESET STATE WHEN QUESTION CHANGES
  // --------------------------------------------------
  useEffect(() => {
    setSelectedAnswer(null);
    setAnswerResult(null);
  }, [quiz?.current_question_index, quiz?.show_question_to_players]);

  // --------------------------------------------------
  // GUARDS
  // --------------------------------------------------
  if (!quizId) return <PageLoader message="Invalid quiz" />;
  if (loading) return <PageLoader message="Joining quiz..." />;
  if (!quiz) return <PageLoader message="Waiting for host..." />;

  const question =
    typeof quiz.current_question_index === 'number' &&
    quiz.current_question_index >= 0 &&
    quiz.current_question_index < questions.length
      ? questions[quiz.current_question_index]
      : null;

  // --------------------------------------------------
  // LOBBY
  // --------------------------------------------------
  if (quiz.game_state === GameState.LOBBY) {
    return <PageLoader message="Waiting for host to start the quiz..." />;
  }

  // --------------------------------------------------
  // QUESTION SHOWN TO PLAYER
  // --------------------------------------------------
  if (
    (quiz.game_state === GameState.QUESTION_ACTIVE ||
      quiz.game_state === GameState.QUESTION_INTRO) &&
    quiz.show_question_to_players &&
    question
  ) {
    const options = [
      question.option_1,
      question.option_2,
      question.option_3,
      question.option_4,
    ].filter(Boolean);

    const handleSelect = (index: number) => {
      if (selectedAnswer !== null) return;

      setSelectedAnswer(index);

      if (index === question.correct_answer_index) {
        setAnswerResult('correct');
      } else {
        setAnswerResult('wrong');
      }
    };

    return (
      <div className="p-6 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-8">
          {question.question_text}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt, index) => {
            let bg = 'bg-slate-200';

            if (selectedAnswer !== null) {
              if (index === question.correct_answer_index) bg = 'bg-green-500 text-white';
              else if (index === selectedAnswer) bg = 'bg-red-500 text-white';
            } else if (selectedAnswer === index) {
              bg = 'bg-gl-orange-600 text-white';
            }

            return (
              <Button
                key={index}
                className={`p-4 ${bg}`}
                onClick={() => handleSelect(index)}
              >
                {opt}
              </Button>
            );
          })}
        </div>

        {answerResult && (
          <div className="mt-6 text-xl font-bold">
            {answerResult === 'correct' ? '✅ Correct!' : '❌ Wrong'}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------
  // WAITING FOR NEXT QUESTION / LEADERBOARD
  // --------------------------------------------------
  if (quiz.game_state === GameState.QUESTION_RESULT) {
    return <PageLoader message="Waiting for next question..." />;
  }

  // --------------------------------------------------
  // QUIZ FINISHED
  // --------------------------------------------------
  if (quiz.game_state === GameState.FINISHED) {
    return (
      <div className="text-center text-2xl font-bold mt-20">
        🎉 Quiz Finished
      </div>
    );
  }

  return <PageLoader message="Loading..." />;
};

export default QuizPlayerPage;
