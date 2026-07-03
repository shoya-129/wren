import { useCallback, useEffect, useRef, useState } from "react";

const CHARS = "!#&?";

export function useEncryptAnimation(
  text,
  {
    delay = 0,
    pause = 1000,
    repeatInterval = 0,
    autoPlay = true,
    speed = 35,
    scrambleCount = 3,
  } = {}
) {
  const [display, setDisplay] = useState(text);

  const animationTimer = useRef(null);
  const delayTimer = useRef(null);
  const repeatTimer = useRef(null);
  const pauseTimer = useRef(null);

  const randomChar = () =>
    CHARS[Math.floor(Math.random() * CHARS.length)];

  const clearAll = () => {
    if (animationTimer.current) clearInterval(animationTimer.current);
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
  };

  const scrambleText = useCallback(
    (source, revealUntil = -1) => {
      const chars = source.split("");

      const indexes = [];

      chars.forEach((c, i) => {
        if (c !== " " && i > revealUntil) {
          indexes.push(i);
        }
      });

      // Shuffle indexes
      for (let i = indexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
      }

      const count = Math.min(scrambleCount, indexes.length);

      for (let i = 0; i < count; i++) {
        chars[indexes[i]] = randomChar();
      }

      return chars.join("");
    },
    [scrambleCount]
  );

  const play = useCallback(() => {
    clearInterval(animationTimer.current);

    // ---------------- Encrypt ----------------

    let encryptFrame = 0;
    const encryptFrames = 12;

    animationTimer.current = setInterval(() => {
      encryptFrame++;

      setDisplay(scrambleText(text));

      if (encryptFrame >= encryptFrames) {
        clearInterval(animationTimer.current);

        // Pause while encrypted
        pauseTimer.current = setTimeout(() => {
          // ---------------- Decrypt ----------------

          let reveal = -1;

          animationTimer.current = setInterval(() => {
            reveal++;

            setDisplay(scrambleText(text, reveal));

            if (reveal >= text.length) {
              clearInterval(animationTimer.current);
              setDisplay(text);
            }
          }, speed);
        }, pause);
      }
    }, speed);
  }, [text, pause, speed, scrambleText]);

  useEffect(() => {
    if (!autoPlay) return;

    delayTimer.current = setTimeout(() => {
      play();

      if (repeatInterval > 0) {
        repeatTimer.current = setInterval(play, repeatInterval);
      }
    }, delay);

    return clearAll;
  }, [play, delay, repeatInterval, autoPlay]);

  return {
    display,
    play,
  };
}


export default useEncryptAnimation;