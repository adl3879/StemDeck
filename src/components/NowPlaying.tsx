import { useNavigate } from "react-router-dom";
import { usePlayer } from "../store/player";
import { IconPlay, IconPause } from "./icons/Icons";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlaying() {
  const navigate = useNavigate();
  const { currentSong, isPlaying, currentTime, duration, play, pause } =
    usePlayer();

  if (!currentSong) return null;

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <div
      className="now-playing"
      onClick={() => navigate(`/song/${currentSong.id}`)}
    >
      <button
        className="now-playing-play"
        onClick={(e) => {
          e.stopPropagation();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>
      <div className="now-playing-info">
        <div className="now-playing-name">{currentSong.name}</div>
        <div className="now-playing-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="now-playing-progress">
          <div
            className="now-playing-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
