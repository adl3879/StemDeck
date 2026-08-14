import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { Song } from "../types";
import { IconPlay, IconPause, IconDelete } from "./icons/Icons";

const REVEAL_WIDTH = 88;
const SWIPE_THRESHOLD = 44;
// The card stays put until the finger has moved this far horizontally, so a
// small wiggle while tapping never exposes the red delete action.
const DRAG_DEADZONE = 14;

interface SongCardProps {
  song: Song;
  isOpen: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onOpenRequest: () => void;
  onCloseRequest: () => void;
  onCardClick: () => void;
  onPlayClick: () => void;
  onDeleteClick: () => void;
  children: ReactNode;
}

export function SongCard({
  song,
  isOpen,
  isCurrent,
  isPlaying,
  isLoading,
  onOpenRequest,
  onCloseRequest,
  onCardClick,
  onPlayClick,
  onDeleteClick,
  children,
}: SongCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startOffset: number;
    moved: boolean;
    captured: boolean;
  } | null>(null);
  const offsetRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    offsetRef.current = isOpen ? -REVEAL_WIDTH : 0;
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${offsetRef.current}px)`;
    }
  }, [isOpen]);

  const applyOffset = (px: number) => {
    offsetRef.current = px;
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${px}px)`;
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setAnimating(false);
    dragRef.current = {
      startX: e.clientX,
      startOffset: isOpen ? -REVEAL_WIDTH : 0,
      moved: false,
      captured: false,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) <= DRAG_DEADZONE) return; // ignore wiggles inside the deadzone
    const effectiveDx = dx - Math.sign(dx) * DRAG_DEADZONE;
    drag.moved = true;
    // Capture only once a real drag starts so plain taps keep their
    // natural click target (pointer capture would redirect the click
    // to the card and swallow the play button's handler).
    if (!drag.captured) {
      drag.captured = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    applyOffset(Math.max(-REVEAL_WIDTH, Math.min(0, drag.startOffset + effectiveDx)));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setAnimating(true);
    if (!drag) return;
    if (drag.captured && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (drag.moved) {
      suppressClickRef.current = true;
      const shouldOpen = offsetRef.current <= -SWIPE_THRESHOLD;
      // Always snap visually on release. Relying only on the isOpen effect would
      // leave the card stuck mid-drag when the open state doesn't actually change
      // (e.g. a partial swipe on an already-closed card).
      applyOffset(shouldOpen ? -REVEAL_WIDTH : 0);
      if (shouldOpen) {
        onOpenRequest();
      } else {
        onCloseRequest();
      }
      return;
    }

    // Plain tap on an open card closes it instead of navigating.
    if (isOpen) {
      suppressClickRef.current = true;
      onCloseRequest();
    }
  };

  const handleCardClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onCardClick();
  };

  const handlePlayClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onPlayClick();
  };

  return (
    <div className="song-card-wrap">
      <button
        className="song-card-delete-reveal"
        onClick={onDeleteClick}
        aria-label={`Delete ${song.name}`}
        tabIndex={isOpen ? 0 : -1}
      >
        <IconDelete />
      </button>
      <div
        ref={cardRef}
        className={`song-card${isOpen ? " is-swiped" : ""}${animating ? " is-animating" : ""}`}
        onClick={handleCardClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="song-card-stem-icons">{children}</div>
        <div className="song-card-info">
          <div className="song-card-name">{song.name}</div>
          <div className="song-card-meta">
            {song.stems.length} stem{song.stems.length !== 1 ? "s" : ""} ·{" "}
            {new Date(song.dateAdded).toLocaleDateString()}
          </div>
        </div>
        <button
          className={`song-card-play btn-icon${isCurrent ? " is-current" : ""}${isLoading ? " is-loading" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handlePlayClick();
          }}
          disabled={isLoading}
          aria-label={
            isLoading
              ? `Loading ${song.name}`
              : isCurrent && isPlaying
                ? `Pause ${song.name}`
                : `Play ${song.name}`
          }
        >
          {isLoading ? (
            <span className="spinner" aria-hidden="true" />
          ) : isCurrent && isPlaying ? (
            <IconPause />
          ) : (
            <IconPlay />
          )}
        </button>
      </div>
    </div>
  );
}
