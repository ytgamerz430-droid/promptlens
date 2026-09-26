import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useStore } from '../store.js';

export function Toasts() {
  const theme = useStore((s) => s.theme);
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={3500}
      hideProgressBar={false}
      closeOnClick
      pauseOnHover
      theme={theme}
      aria-label="Notifications"
    />
  );
}

export { toast } from 'react-toastify';
