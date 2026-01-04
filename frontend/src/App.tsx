import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { DockerBuild } from '@/pages/docker/DockerBuild';
import { DockerCompose } from '@/pages/docker/DockerCompose';
import { KubernetesDeploy } from '@/pages/k8s/KubernetesDeploy';
import { CICDPipeline } from '@/pages/cicd/CICDPipeline';
import { LearningPath } from '@/pages/learn/LearningPath';
import { Login } from '@/pages/login/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/docker"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DockerBuild />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compose"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DockerCompose />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kubernetes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <KubernetesDeploy />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cicd"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CICDPipeline />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/learning"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LearningPath />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
