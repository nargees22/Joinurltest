import { QRCodeDisplay } from "./QRCodeDisplay";

export const PersistentQRCode: React.FC<{ quizId: string }> = ({ quizId }) => {
  if (!quizId) return null;

  // ✅ AI Studio SAFE (NO pathname, NO href)
  const joinUrl = `${window.location.origin}/#/join/${quizId}`;

  return (
    <div className="fixed bottom-20 left-4 z-50 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl text-center">
      <h3 className="text-sm font-bold mb-2 text-slate-800">Scan to Join!</h3>
      <QRCodeDisplay text={joinUrl} size={100} />
      <p className="mt-2 text-lg font-extrabold">{quizId}</p>
    </div>
  );
};
