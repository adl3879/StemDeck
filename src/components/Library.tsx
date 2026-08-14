import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Song, StemType } from "../types";
import { getAllSongs, saveSong, deleteSong, generateId, createStem } from "../store/db";
import { usePlayer } from "../store/player";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "../hooks/useTheme";
import { NowPlaying } from "./NowPlaying";
import { SongCard } from "./SongCard";
import { IconPlus } from "./icons/Icons";

const STEM_ICON_SRC: Record<StemType, string> = {
  drums: "/drum.svg",
  bass: "/guitar.svg",
  vocals: "/voice.svg",
  other: "/others.svg",
};

export function Library() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [songName, setSongName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const { currentSong, isPlaying, playSong, play, pause, closeSong } =
    usePlayer();
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useEffect(() => {
    getAllSongs().then(setSongs);
  }, []);

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("webkitdirectory", "");
      fileInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const handleFiles = (files: FileList) => {
    const audioFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|flac|m4a|aac|aiff|wma)$/i.test(f.name)
    );
    if (audioFiles.length === 0) return;

    const dirName = (files[0] as any).webkitRelativePath?.split("/")[0] || "";
    if (dirName) {
      addSong(dirName, audioFiles);
    } else {
      setPendingFiles(audioFiles);
      setSongName("");
      setShowNamePrompt(true);
    }
  };

  const addSong = async (name: string, files: File[]) => {
    const song: Song = {
      id: generateId(),
      name,
      dateAdded: Date.now(),
      stems: files.map((f, i) => createStem(f, i)),
    };
    await saveSong(song);
    const updated = await getAllSongs();
    setSongs(updated);
  };

  const confirmName = async () => {
    const name = songName.trim() || "Untitled Song";
    await addSong(name, pendingFiles);
    setShowNamePrompt(false);
    setPendingFiles([]);
  };

  const handleQuickPlay = (song: Song) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        pause();
      } else {
        void play();
      }
      return;
    }
    setLoadingSongId(song.id);
    void playSong(song).then(() =>
      setLoadingSongId((id) => (id === song.id ? null : id))
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSong(deleteTarget.id);
    if (currentSong?.id === deleteTarget.id) closeSong();
    const updated = await getAllSongs();
    setSongs(updated);
    setDeleteTarget(null);
  };

  const getStemIconSet = (song: Song) => {
    const types = new Set(song.stems.map((s) => s.type));
    return Array.from(types).map((t) => (
      <img
        key={t}
        src={STEM_ICON_SRC[t]}
        alt={t}
        width="20"
        height="20"
        draggable={false}
      />
    ));
  };

  return (
    <>
      <div className="header">
        <h1 className="header-title">StemDeck</h1>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>

      <div className={`content${currentSong ? " content-with-player" : ""}`}>
        {songs.length === 0 ? (
          <div className="empty-state">
            <img src="/others.svg" alt="" width="32" height="32" style={{ opacity: 0.4 }} />
            <h2>No songs yet</h2>
            <p>Add a folder of stems to start mixing.</p>
          </div>
        ) : (
          <div className="song-list">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                isOpen={openCardId === song.id}
                isCurrent={currentSong?.id === song.id}
                isPlaying={isPlaying}
                isLoading={loadingSongId === song.id}
                onOpenRequest={() => setOpenCardId(song.id)}
                onCloseRequest={() =>
                  setOpenCardId((id) => (id === song.id ? null : id))
                }
                onCardClick={() => navigate(`/song/${song.id}`)}
                onPlayClick={() => handleQuickPlay(song)}
                onDeleteClick={() => {
                  setOpenCardId(null);
                  setDeleteTarget(song);
                }}
              >
                {getStemIconSet(song)}
              </SongCard>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div
          className="add-song-zone"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="plus-icon">
            <IconPlus />
          </div>
          <span className="label">Add Song</span>
          <span className="hint">Select a folder of stems</span>
        </div>
      </div>

      <NowPlaying />

      {showNamePrompt && (
        <div className="dialog-overlay" onClick={() => setShowNamePrompt(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Name your song</h2>
            <p>
              {pendingFiles.length} stem{pendingFiles.length !== 1 ? "s" : ""}{" "}
              selected
            </p>
            <input
              className="dialog-input"
              placeholder="Song name..."
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmName()}
              autoFocus
            />
            <div className="dialog-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowNamePrompt(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmName}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="dialog-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="danger-text">Delete song?</h2>
            <p>
              This will permanently remove "{deleteTarget.name}" and all its
              stems.
            </p>
            <div className="dialog-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
