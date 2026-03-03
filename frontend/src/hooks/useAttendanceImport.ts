import { useContext } from "react";
import { AttendanceImportContext } from "@/context/AttendanceImportContext";

export function useAttendanceImport() {
  const context = useContext(AttendanceImportContext);

  if (!context) {
    throw new Error("useAttendanceImport must be used within an AttendanceImportProvider");
  }

  return context;
}
