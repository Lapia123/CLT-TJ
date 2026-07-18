import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext(null);

function apply(theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("theme-light");
    root.style.colorScheme = "light";
  } else {
    root.classList.remove("theme-light");
    root.style.colorScheme = "dark";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("clt_theme") || "dark");

  useEffect(() => {
    apply(theme);
    localStorage.setItem("clt_theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
