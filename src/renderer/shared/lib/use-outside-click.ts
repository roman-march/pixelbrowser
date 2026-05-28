import { useEffect, useRef } from "react";

export function useOutsideClick<T extends HTMLElement>(
  active: boolean,
  onOutsideClick: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) {
        return;
      }
      onOutsideClick();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [active, onOutsideClick]);

  return ref;
}
