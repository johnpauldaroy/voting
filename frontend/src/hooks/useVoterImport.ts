import { useContext } from "react";
import { VoterImportContext } from "@/context/VoterImportContext";

export function useVoterImport() {
  const context = useContext(VoterImportContext);

  if (!context) {
    throw new Error("useVoterImport must be used within a VoterImportProvider");
  }

  return context;
}
