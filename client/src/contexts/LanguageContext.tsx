import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, translations, TranslationKey } from "@/lib/translations";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("it");

  // Fetch current user to get their language preference
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  // Update language mutation
  const updateLanguageMutation = useMutation({
    mutationFn: async (lang: Language) => {
      return apiRequest("PATCH", "/api/users/update-language", { language: lang });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  // Set language from user preference
  useEffect(() => {
    if (user && typeof user === "object" && "language" in user) {
      setLanguageState((user as any).language as Language);
    }
  }, [user]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    updateLanguageMutation.mutate(lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
