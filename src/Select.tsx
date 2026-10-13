import {
  Children,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
type Props = {
  "aria-label": string;
  value: string | number;
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
};
export default function Select({
  "aria-label": label,
  value,
  onChange,
  children,
}: Props) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as {
        value: string | number;
        children: ReactNode;
      };
      return { value: String(props.value), label: props.children };
    });
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === String(value)),
  );
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(selected);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, maxHeight: 260 });
  useLayoutEffect(() => {
    if (!open) return;
    let positionFrame = 0;
    const started = performance.now();
    const position = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const height = Math.min(260, options.length * 48 + 12),
        width = Math.min(Math.max(rect.width, 220), innerWidth - 24);
      const below = innerHeight - rect.bottom - 12;
      const next = {
        left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)),
        top:
          below >= height
            ? rect.bottom + 7
            : Math.max(12, rect.top - height - 7),
        width,
        maxHeight: Math.min(height, innerHeight - 24),
      };
      setBox((old) =>
        old.left === next.left &&
        old.top === next.top &&
        old.width === next.width &&
        old.maxHeight === next.maxHeight
          ? old
          : next,
      );
      if (performance.now() - started < 600)
        positionFrame = requestAnimationFrame(position);
    };
    position();
    const outside = (e: PointerEvent) => {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => {
      cancelAnimationFrame(positionFrame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, options.length]);
  useLayoutEffect(() => {
    if (open)
      menu.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const choose = (index: number) => {
    onChange({ target: { value: options[index].value } });
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="art-select">
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? id + "-" + active : undefined}
        onClick={() => {
          setActive(selected);
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setActive(selected);
              setOpen(true);
            } else
              setActive(
                (i) =>
                  (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
                  options.length,
              );
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) choose(active);
            else {
              setActive(selected);
              setOpen(true);
            }
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "Tab") setOpen(false);
          else if (open && (e.key === "Home" || e.key === "End")) {
            e.preventDefault();
            setActive(e.key === "Home" ? 0 : options.length - 1);
          }
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={15} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            className="art-select-menu"
            style={box}
          >
            {options.map((option, i) => (
              <div
                key={option.value}
                role="option"
                id={id + "-" + i}
                aria-selected={option.value === String(value)}
                data-active={i === active}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span>{option.label}</span>
                {option.value === String(value) && <Check size={14} />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
