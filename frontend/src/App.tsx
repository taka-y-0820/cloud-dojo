import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { DockerBuild } from '@/pages/DockerBuild';
import { DockerCompose } from '@/pages/DockerCompose';
import { KubernetesDeploy } from '@/pages/KubernetesDeploy';
import { CICDPipeline } from '@/pages/CICDPipeline';
import { LogStream } from '@/pages/LogStream';
import { LearningPath } from '@/pages/LearningPath';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/docker" element={<DockerBuild />} />
        <Route path="/compose" element={<DockerCompose />} />
        <Route path="/kubernetes" element={<KubernetesDeploy />} />
        <Route path="/cicd" element={<CICDPipeline />} />
        <Route path="/logs" element={<LogStream />} />
        <Route path="/learning" element={<LearningPath />} />
      </Routes>
    </Layout>
  );
}

export default App;
