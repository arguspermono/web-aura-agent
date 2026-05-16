import { navigate, setupNavigation, state } from '../main.js';
import { completeRegistration } from '../services/api_service.js';

export function renderOnboarding() {
  const container = document.createElement('div');
  container.className = 'w-full min-h-[calc(100dvh-120px)] flex items-center justify-center py-8';

  container.innerHTML = `
    <section class="w-full max-w-2xl rounded-2xl border border-outline-variant/50 bg-white/80 p-6 shadow-[0_18px_48px_rgba(70,72,212,0.14)] backdrop-blur-xl sm:p-10 flex flex-col gap-8">
      <div class="text-center flex flex-col gap-2">
        <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">person_check</span>
        </div>
        <h2 class="font-display-lg text-display-lg text-on-surface">What best describes you?</h2>
        <p class="text-body-md text-on-surface-variant">
          Select your role to personalize your Aura AI experience.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Buyer Card -->
        <button id="role-buyer" type="button" aria-pressed="false" class="group flex flex-col text-left gap-3 rounded-2xl border-2 border-outline-variant/50 bg-surface p-6 transition-all hover:-translate-y-1 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <div class="flex items-start justify-between gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">shopping_cart</span>
            </div>
            <span data-role-check="buyer" class="hidden material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <div>
            <h3 class="font-title-lg text-title-lg text-on-surface">I'm a Buyer</h3>
            <p class="mt-1 text-body-sm text-on-surface-variant">I want to file claims for products I purchased</p>
          </div>
        </button>

        <!-- Seller Card -->
        <button id="role-seller" type="button" aria-pressed="false" class="group flex flex-col text-left gap-3 rounded-2xl border-2 border-outline-variant/50 bg-surface p-6 transition-all hover:-translate-y-1 hover:border-secondary/50 hover:bg-secondary/5 hover:shadow-lg hover:shadow-secondary/10 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20">
          <div class="flex items-start justify-between gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary transition-transform group-hover:scale-110">
              <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">storefront</span>
            </div>
            <span data-role-check="seller" class="hidden material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <div>
            <h3 class="font-title-lg text-title-lg text-on-surface">I'm a Seller</h3>
            <p class="mt-1 text-body-sm text-on-surface-variant">I manage my store and review customer claims</p>
          </div>
        </button>
      </div>

      <div class="flex flex-col gap-3">
        <button id="confirm-role" type="button" disabled class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-body-md font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-outline-variant disabled:text-on-surface-variant">
          <span class="material-symbols-outlined text-[20px]">check</span>
          <span>Confirm selection</span>
        </button>
        <p id="role-helper" class="text-center text-body-sm text-on-surface-variant">Choose Buyer or Seller first.</p>
      </div>
      
      <p id="onboarding-error" class="hidden text-center text-body-sm text-error"></p>
    </section>
  `;

  const buyerBtn = container.querySelector('#role-buyer');
  const sellerBtn = container.querySelector('#role-seller');
  const confirmBtn = container.querySelector('#confirm-role');
  const helperText = container.querySelector('#role-helper');
  const errorText = container.querySelector('#onboarding-error');
  let selectedRole = null;

  const updateSelectedRole = (role) => {
    selectedRole = role;
    errorText.classList.add('hidden');

    buyerBtn.setAttribute('aria-pressed', role === 'buyer' ? 'true' : 'false');
    sellerBtn.setAttribute('aria-pressed', role === 'seller' ? 'true' : 'false');

    buyerBtn.classList.toggle('border-primary', role === 'buyer');
    buyerBtn.classList.toggle('bg-primary/5', role === 'buyer');
    buyerBtn.classList.toggle('ring-2', role === 'buyer');
    buyerBtn.classList.toggle('ring-primary/20', role === 'buyer');
    sellerBtn.classList.toggle('border-secondary', role === 'seller');
    sellerBtn.classList.toggle('bg-secondary/5', role === 'seller');
    sellerBtn.classList.toggle('ring-2', role === 'seller');
    sellerBtn.classList.toggle('ring-secondary/20', role === 'seller');

    container.querySelector('[data-role-check="buyer"]').classList.toggle('hidden', role !== 'buyer');
    container.querySelector('[data-role-check="seller"]').classList.toggle('hidden', role !== 'seller');

    confirmBtn.disabled = false;
    helperText.textContent = role === 'buyer'
      ? 'Buyer selected. Confirm to continue to your claim dashboard.'
      : 'Seller selected. Confirm to continue to the seller dashboard.';
  };

  const selectRole = async (role) => {
    buyerBtn.disabled = true;
    sellerBtn.disabled = true;
    confirmBtn.disabled = true;
    errorText.classList.add('hidden');
    
    confirmBtn.innerHTML = `
      <span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
      <span>Saving...</span>
    `;

    try {
      try {
        await completeRegistration(role);
      } catch (e) {
        console.warn('API update failed, continuing locally', e);
      }

      localStorage.setItem('aura_user_role', role);
      if (state.currentUserId) {
        localStorage.setItem('aura_user_id', state.currentUserId);
      }
      sessionStorage.removeItem('is_new_user');
      
      setupNavigation();

      if (role === 'seller') {
        navigate('seller_dashboard');
      } else {
        navigate('hub');
      }
    } catch (error) {
      errorText.textContent = error.message || 'Failed to set role. Please try again.';
      errorText.classList.remove('hidden');
      buyerBtn.disabled = false;
      sellerBtn.disabled = false;
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `
        <span class="material-symbols-outlined text-[20px]">check</span>
        <span>Confirm selection</span>
      `;
    }
  };

  buyerBtn.addEventListener('click', () => updateSelectedRole('buyer'));
  sellerBtn.addEventListener('click', () => updateSelectedRole('seller'));
  confirmBtn.addEventListener('click', () => {
    if (!selectedRole) {
      helperText.textContent = 'Please choose Buyer or Seller before continuing.';
      return;
    }
    selectRole(selectedRole);
  });

  return container;
}
