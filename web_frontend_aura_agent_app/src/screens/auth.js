import { login, register } from '../services/auth_service.js';
import { registerUserProfile } from '../services/api_service.js';

function getAuthErrorMessage(error) {
  const code = error?.code || '';

  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('email-already-in-use')) return 'This email is already registered. Login instead.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.';

  return error?.message || 'Authentication failed. Try again.';
}

export function renderAuthScreen({ configError = null } = {}) {
  const container = document.createElement('div');
  container.className = 'w-full min-h-[calc(100dvh-120px)] flex items-center justify-center py-8';

  let mode = 'login';

  const renderForm = () => {
    const isRegister = mode === 'register';

    container.innerHTML = `
      <section class="w-full max-w-md rounded-2xl border border-outline-variant/50 bg-white/80 p-6 shadow-[0_18px_48px_rgba(70,72,212,0.14)] backdrop-blur-xl sm:p-8">
        <div class="mb-6 flex flex-col gap-2">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">verified_user</span>
          </div>
          <p class="font-label-caps uppercase tracking-widest text-primary">Secure Access</p>
          <h2 class="font-display-lg text-display-lg text-on-surface">${isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p class="text-body-md text-on-surface-variant">
            ${isRegister ? 'Register to submit and track claims with Aura AI.' : 'Login to continue managing your claims.'}
          </p>
        </div>

        ${configError ? `
          <div class="mb-5 rounded-xl border border-error/20 bg-error-container/60 p-4 text-body-sm text-on-error-container">
            ${configError.message}
          </div>
        ` : ''}

        <form id="auth-form" class="flex flex-col gap-4">
          ${isRegister ? `
            <label class="flex flex-col gap-2 text-body-sm font-medium text-on-surface">
              Username
              <input id="auth-username" type="text" autocomplete="username" class="min-h-12 rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="rafif.nuha" ${configError ? 'disabled' : ''} required />
            </label>
          ` : ''}
          <label class="flex flex-col gap-2 text-body-sm font-medium text-on-surface">
            Email
            <input id="auth-email" type="email" autocomplete="email" class="min-h-12 rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="you@example.com" ${configError ? 'disabled' : ''} required />
          </label>
          <label class="flex flex-col gap-2 text-body-sm font-medium text-on-surface">
            Password
            <input id="auth-password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" class="min-h-12 rounded-xl border border-outline-variant/60 bg-surface px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Minimum 6 characters" ${configError ? 'disabled' : ''} required />
          </label>
          <p id="auth-error" class="hidden text-body-sm text-error"></p>
          <button id="auth-submit" type="submit" class="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-title-sm text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70" ${configError ? 'disabled' : ''}>
            <span id="auth-submit-icon" class="material-symbols-outlined text-[20px]">${isRegister ? 'person_add' : 'login'}</span>
            <span id="auth-submit-label">${isRegister ? 'Register' : 'Login'}</span>
          </button>
        </form>

        <button id="auth-mode-toggle" type="button" class="mt-5 w-full text-center text-body-sm font-medium text-primary hover:underline" ${configError ? 'disabled' : ''}>
          ${isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </section>
    `;

    const form = container.querySelector('#auth-form');
    const toggle = container.querySelector('#auth-mode-toggle');
    const usernameInput = container.querySelector('#auth-username');
    const emailInput = container.querySelector('#auth-email');
    const passwordInput = container.querySelector('#auth-password');
    const errorText = container.querySelector('#auth-error');
    const submitButton = container.querySelector('#auth-submit');
    const submitLabel = container.querySelector('#auth-submit-label');

    toggle?.addEventListener('click', () => {
      mode = mode === 'login' ? 'register' : 'login';
      renderForm();
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorText.classList.add('hidden');
      errorText.textContent = '';
      submitButton.disabled = true;
      submitLabel.textContent = isRegister ? 'Creating account...' : 'Logging in...';

      try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const username = usernameInput?.value.trim() || '';

        if (isRegister) {
          if (!username) {
            throw new Error('Username is required.');
          }
          
          // Set this before register() so that onAuthStateChanged catches it instantly
          sessionStorage.setItem('is_new_user', 'true');
          
          try {
            await register(email, password, username);
            await registerUserProfile({ username, email });
          } catch (err) {
            sessionStorage.removeItem('is_new_user');
            throw err;
          }
        } else {
          await login(email, password);
        }
      } catch (error) {
        errorText.textContent = getAuthErrorMessage(error);
        errorText.classList.remove('hidden');
        submitButton.disabled = false;
        submitLabel.textContent = isRegister ? 'Register' : 'Login';
      }
    });
  };

  renderForm();
  return container;
}
