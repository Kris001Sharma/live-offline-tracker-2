import { ApplicationLifecycleProvider } from './shell';
import AppRouter from './router';

export default function App() {
  return (
    <ApplicationLifecycleProvider>
      <AppRouter />
    </ApplicationLifecycleProvider>
  );
}