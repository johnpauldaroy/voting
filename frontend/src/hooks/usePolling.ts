import { useEffect, useRef } from "react";

export function usePolling(callback: () => void | Promise<void>, delay = 10000, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = setInterval(() => {
      void callbackRef.current();
    }, delay);

    return () => {
      clearInterval(intervalId);
    };
  }, [delay, enabled]);
}
