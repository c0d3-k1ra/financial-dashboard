import { useEffect } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import { setActiveCurrency } from "./constants";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useGetSettings({
    query: { queryKey: ["/api/settings"] },
  });

  useEffect(() => {
    if (settings?.currencyCode) {
      setActiveCurrency(settings.currencyCode);
    }
  }, [settings?.currencyCode]);

  return <>{children}</>;
}
