import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "./AuthContext.jsx";

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  // null = "All accounts"
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get("/api/accounts");
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Params helper: spreads {account_id} into a query when a specific account is selected.
  const accountParams = selectedId ? { account_id: selectedId } : {};

  return (
    <AccountContext.Provider
      value={{ accounts, selectedId, setSelectedId, accountParams, reloadAccounts: load, loading }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountContext);
}
