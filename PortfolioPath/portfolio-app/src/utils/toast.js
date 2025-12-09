/**
 * Simple Toast Notification System
 * Provides user-friendly notifications without external dependencies
 */

let toastContainer = null;
let toastId = 0;

const createToastContainer = () => {
  if (toastContainer) return toastContainer;
  
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
  document.body.appendChild(container);
  toastContainer = container;
  return container;
};

const removeToast = (id) => {
  const toast = document.getElementById(`toast-${id}`);
  if (toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }
};

const showToast = (message, type = 'info', duration = 4000) => {
  createToastContainer();
  
  const id = toastId++;
  const toast = document.createElement('div');
  toast.id = `toast-${id}`;
  
  const colors = {
    success: 'bg-emerald-500 border-emerald-400',
    error: 'bg-red-500 border-red-400',
    warning: 'bg-yellow-500 border-yellow-400',
    info: 'bg-blue-500 border-blue-400',
  };
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };
  
  toast.className = `pointer-events-auto min-w-[300px] max-w-md px-4 py-3 rounded-lg shadow-xl border-2 ${colors[type]} text-white flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0`;
  toast.style.transition = 'all 0.3s ease-out';
  
  toast.innerHTML = `
    <span class="text-xl font-bold">${icons[type]}</span>
    <span class="flex-1 text-sm font-medium">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white text-lg font-bold">&times;</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto remove
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  
  return id;
};

export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  warning: (message, duration) => showToast(message, 'warning', duration),
  info: (message, duration) => showToast(message, 'info', duration),
};

export default toast;

