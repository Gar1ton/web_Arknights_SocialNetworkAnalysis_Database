import { useSyncExternalStore } from "react";
import { lang, subscribe } from "./i18n";
/** The current language; re-renders the caller when it changes. */
export const useLang = () => useSyncExternalStore(subscribe, lang, lang);
