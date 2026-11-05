declare const __OFFLINE__: boolean | undefined;
declare const __APP_VERSION__: string | undefined;
/** The desktop build (vite --mode offline): nothing leaves the machine. */
export const offline = typeof __OFFLINE__ !== "undefined" && __OFFLINE__;
export const appVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
