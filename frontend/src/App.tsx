import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/guards/ProtectedRoute'
import { ErrorBoundary } from '@/components/organisms/ErrorBoundary'
import { LoginPage } from '@/pages/LoginPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { HomePage } from '@/pages/HomePage'
import { ShoppingListsPage } from '@/pages/ShoppingListsPage'
import { ShoppingListDetailPage } from '@/pages/ShoppingListDetailPage'
import { RecipesPage } from '@/pages/RecipesPage'
import { RecipeDetailPage } from '@/pages/RecipeDetailPage'
import { AddRecipePage } from '@/pages/AddRecipePage'
import { EditRecipePage } from '@/pages/EditRecipePage'
import { HouseholdPage } from '@/pages/HouseholdPage'
import { queryClient } from '@/lib/queryClient'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shopping-lists"
              element={
                <ProtectedRoute>
                  <ShoppingListsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shopping-lists/:id"
              element={
                <ProtectedRoute>
                  <ShoppingListDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes"
              element={
                <ProtectedRoute>
                  <RecipesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/new"
              element={
                <ProtectedRoute>
                  <AddRecipePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id"
              element={
                <ProtectedRoute>
                  <RecipeDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id/edit"
              element={
                <ProtectedRoute>
                  <EditRecipePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/household"
              element={
                <ProtectedRoute>
                  <HouseholdPage />
                </ProtectedRoute>
              }
            />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
      <ToastContainer
        position="bottom-right"
        newestOnTop
        closeOnClick
        draggable
        pauseOnHover
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
