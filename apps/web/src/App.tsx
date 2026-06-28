import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { AppShell } from "@/components/app-shell"
import { AppStateProvider } from "@/state"
import { BatchPage } from "@/pages/batch-page"
import { ReportsPage } from "@/pages/reports-page"
import { StudentsPage } from "@/pages/students-page"
import { TestPage } from "@/pages/test-page"

export function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/test" replace />} />
            <Route path="test" element={<TestPage />} />
            <Route path="batch" element={<BatchPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/test" replace />} />
          </Route>
        </Routes>
      </AppStateProvider>
    </BrowserRouter>
  )
}
