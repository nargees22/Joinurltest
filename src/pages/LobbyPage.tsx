import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Quiz, Player } from '../../types';
import { GameState, Clan } from '../../types';
import { PageLoader } from '../components/PageLoader';
import Card from '../components/Card';
import Button from '../components/Button';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { CopyIcon } from '../icons/CopyIcon';
import { supabase } from '../service/supabase';

const LobbyPage = () => {
  /* -------------------- HOOKS (MUST COME FIRST) -------------------- */
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  /* -------------------- EFFECT -------------------- */
  useEffect(() => {
    if (!quizId) return;

    const fetchQuiz = async () => {
      const { data, error } = await supabase
        .from('quiz_master_structure')
        .select(`
          quiz_id,
          title,
          game_state,
          clan_based,
          show_live_response_count,
          show_question_to_players,
          titan_name,
          defender_name
        `)
        .eq('quiz_id', quizId)
        .single();

      if (error || !data) {
        console.error('Error fetching quiz:', error);
        navigate('/');
        return;
      }

      setQuiz({
        id: data.quiz_id,
        title: data.title,
        gameState: data.game_state,
        config: {
          clanBased: data.clan_based,
          showLiveResponseCount: data.show_live_response_count,
          showQuestionToPlayers: data.show_question_to_players,
          clanNames: {
            [Clan.TITANS]: data.titan_name || 'Titans',
            [Clan.DEFENDERS]: data.defender_name || 'Defenders',
          },
        },
      } as Quiz);
    };

    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('quiz_players')
        .select('player_id, player_name, clan')
        .eq('quiz_id', quizId);

      if (!data) return;

      setPlayers(
        data.map((p) => ({
          id: p.player_id,
          name: p.player_name,
          clan: p.clan,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.player_name}`,
        }))
      );
    };

    fetchQuiz();
    fetchPlayers();

    /* 🔴 REAL-TIME SUBSCRIPTION */
    const channel = supabase
      .channel(`lobby-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_players',
          filter: `quiz_id=eq.${quizId}`,
        },
        fetchPlayers
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, navigate]);

  /* -------------------- SAFETY RETURNS (AFTER HOOKS) -------------------- */
  if (!quizId || quizId.length !== 6) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-lg font-semibold">
          Invalid Quiz Code
        </div>
      </div>
    );
  }

  if (!quiz) {
    return <PageLoader message="Loading lobby..." />;
  }

  /* -------------------- HELPERS -------------------- */
  const joinUrl =
    window.location.href.split('#')[0].replace(/^blob:/, '') +
    `#/join/${quiz.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStartQuiz = async () => {
    const nextState = quiz.config.clanBased
      ? GameState.CLAN_BATTLE_VS
      : GameState.QUESTION_INTRO;

    const { error } = await supabase
      .from('quiz_master_structure')
      .update({ game_state: nextState })
      .eq('quiz_id', quizId);

    if (!error) {
      navigate(`/quiz/host/${quizId}`);
    } else {
      console.error('Failed to start quiz:', error);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl text-center">
        <h1 className="text-3xl font-bold mb-2 text-gl-orange-600">
          {quiz.title}
        </h1>

        <p className="text-slate-500 mb-6">
          Players will join using the code or QR code below.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Scan to Join!</h2>
            <QRCodeDisplay text={joinUrl} />
            <p className="mt-4 text-4xl font-extrabold tracking-widest bg-slate-100 p-4 rounded-lg">
              {quiz.id}
            </p>

            <button
              onClick={handleCopyLink}
              className="mt-4 w-full flex justify-center items-center gap-2 bg-slate-200 hover:bg-slate-300 font-bold py-2 rounded-lg"
            >
              <CopyIcon />
              {isCopied ? 'Copied!' : 'Copy Join Link'}
            </button>
          </div>

          {/* RIGHT */}
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Players ({players.length})
            </h2>

            <div className="bg-slate-50 rounded-lg p-4 h-64 overflow-y-auto border">
              {players.length === 0 ? (
                <p className="text-slate-500">Waiting for players to join...</p>
              ) : (
                <ul className="space-y-2 text-left">
                  {players.map((p) => (
                    <li
                      key={p.id}
                      className="bg-white p-2 rounded-md flex items-center border"
                    >
                      <img
                        src={p.avatar}
                        alt="avatar"
                        className="w-8 h-8 rounded-full mr-3"
                      />
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={handleStartQuiz}
          disabled={players.length === 0}
          className="bg-gl-orange-600 hover:bg-gl-orange-700 mt-8 w-1/2 mx-auto text-xl"
        >
          Start Quiz
        </Button>
      </Card>
    </div>
  );
};

export default LobbyPage;
