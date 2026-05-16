import './style.css';
import { renderHub } from './screens/hub.js';
import { renderEvidence } from './screens/evidence.js';
import { renderAiAnalysis } from './screens/ai_analysis.js';
import { renderDecision } from './screens/decision.js';
import { renderNotifications } from './screens/notifications.js';
import { renderAuthScreen } from './screens/auth.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderSellerDashboard } from './screens/seller_dashboard.js';
import { renderSellerClaimDetail } from './screens/seller_claim_detail.js';
import { renderUserClaims } from './screens/user_claims.js';
import { renderUserClaimDetail } from './screens/user_claim_detail.js';
import { fetchClaims, getUserProfile } from './services/api_service.js';
import { logout, subscribeToAuthState } from './services/auth_service.js';
import {
  getUnreadClaimCount,
  markNotificationsSeen
} from './services/notification_state.js';
import {
  clearDraftClaimPersistence,
  DEFAULT_DRAFT_CLAIM,
  loadDraftClaim,
  persistDraftClaim
} from './config/demo.js';

// App State
export const state = {
  currentRoute: 'hub',
  currentUser: null,
  currentUserId: null,
  currentUsername: '',
  authReady: false,
  authError: null,
  currentClaim: null,
  currentClaimStatus: null,
  selectedClaimId: null,
  draftClaim: loadDraftClaim()
};

// Routes definition
export const routes = {
  'hub': { label: 'Hub', icon: 'grid_view', render: renderHub, showNav: true, showInNav: true },
  'seller_dashboard': { label: 'Seller Dashboard', icon: 'storefront', render: renderSellerDashboard, showNav: true, showInNav: true },
  'evidence': { label: 'Create Claim', icon: 'add_circle', render: renderEvidence, showNav: true, showInNav: true },
  'notifications': { label: 'Notifications', icon: 'notifications', render: renderNotifications, showNav: true, showInNav: true },
  'user_claims': { label: 'History', icon: 'receipt_long', render: renderUserClaims, showNav: true, showInNav: true },
  'analysis': { label: 'Analysis', icon: 'auto_awesome', render: renderAiAnalysis, showNav: false, showInNav: false },
  'decision': { label: 'Result', icon: 'verified', render: renderDecision, showNav: false, showInNav: false },
  'onboarding': { label: 'Onboarding', icon: 'person_add', render: renderOnboarding, showNav: false, showInNav: false },
  'seller_claim_detail': { label: 'Claim Detail', icon: 'receipt_long', render: renderSellerClaimDetail, showNav: true, showInNav: false },
  'user_claim_detail': { label: 'Claim Detail', icon: 'receipt_long', render: renderUserClaimDetail, showNav: true, showInNav: false }
};

async function refreshNotificationIndicator() {
  const notificationsButton = document.getElementById('notifications-button');
  const notificationsBadge = document.getElementById('notifications-badge');
  if (!notificationsButton || !notificationsBadge) return;
  const role = localStorage.getItem('aura_user_role') || 'buyer';

  if (role === 'seller') {
    notificationsButton.classList.add('hidden');
    notificationsBadge.classList.add('hidden');
    return;
  }

  notificationsButton.classList.remove('hidden');

  if (!state.currentUser || !state.currentUserId) {
    notificationsBadge.classList.add('hidden');
    notificationsButton.classList.remove('border-rose-200', 'bg-rose-50', 'text-rose-600');
    notificationsButton.classList.add('border-outline-variant/50', 'bg-surface', 'text-on-surface');
    return;
  }

  try {
    const claims = await fetchClaims(state.currentUserId);
    const unreadCount = getUnreadClaimCount(claims, state.currentUserId);

    if (unreadCount > 0) {
      notificationsBadge.textContent = unreadCount > 99 ? '99+' : `${unreadCount}`;
      notificationsBadge.classList.remove('hidden');
      notificationsButton.classList.remove('border-outline-variant/50', 'bg-surface', 'text-on-surface');
      notificationsButton.classList.add('border-rose-200', 'bg-rose-50', 'text-rose-600');
    } else {
      notificationsBadge.classList.add('hidden');
      notificationsButton.classList.remove('border-rose-200', 'bg-rose-50', 'text-rose-600');
      notificationsButton.classList.add('border-outline-variant/50', 'bg-surface', 'text-on-surface');
    }
  } catch {
    notificationsBadge.classList.add('hidden');
    notificationsButton.classList.remove('border-rose-200', 'bg-rose-50', 'text-rose-600');
    notificationsButton.classList.add('border-outline-variant/50', 'bg-surface', 'text-on-surface');
  }
}

function updateConnectivityBanner() {
  const offlineBanner = document.getElementById('offline-banner');
  if (!offlineBanner) return;

  const isOffline = navigator.onLine === false;
  offlineBanner.classList.toggle('hidden', !isOffline);

  if (!isOffline) {
    refreshNotificationIndicator();
  }
}

function refreshCurrentRouteForConnectivity() {
  if (!state.authReady || !state.currentUser) return;
  if (!['hub', 'user_claims', 'notifications'].includes(state.currentRoute)) return;
  navigate(state.currentRoute);
}

function initApp() {
  setupNavigation();
  setupTopBarActions();
  setupConnectivityState();
  setupDragScroll();
  renderAuthLoading();
  subscribeToAuthState(async (user, error) => {
    state.authReady = true;
    state.authError = error;
    state.currentUser = user;
    state.currentUserId = user?.uid || null;
    state.currentUsername = user?.displayName || '';

    if (!user) {
      state.currentClaim = null;
      state.currentClaimStatus = null;
      state.currentUsername = '';
      setupNavigation();
      updateAccountUi();
      refreshNotificationIndicator();
      updateConnectivityBanner();
      navigate('auth');
      return;
    }

    let targetRoute = state.currentRoute;
    if (sessionStorage.getItem('is_new_user') === 'true') {
      targetRoute = 'onboarding';
    } else {
      try {
        const profile = await getUserProfile();
        if (profile && profile.role) {
          localStorage.setItem('aura_user_role', profile.role);
        }
      } catch (e) {
        console.warn('Failed to fetch user profile role', e);
      }
      
      const role = localStorage.getItem('aura_user_role') || 'buyer';
      if (targetRoute === 'auth' || targetRoute === 'hub') {
        targetRoute = role === 'seller' ? 'seller_dashboard' : 'hub';
      }
    }

    setupNavigation();
    updateAccountUi();
    refreshNotificationIndicator();
    updateConnectivityBanner();
    navigate(targetRoute);
  });
}

function setupConnectivityState() {
  window.addEventListener('online', () => {
    updateConnectivityBanner();
    refreshCurrentRouteForConnectivity();
  });
  window.addEventListener('offline', () => {
    updateConnectivityBanner();
    refreshCurrentRouteForConnectivity();
  });
  updateConnectivityBanner();
}

export function setupNavigation() {
  const navContainer = document.getElementById('bottom-nav');
  const desktopContainer = document.getElementById('desktop-nav');
  navContainer.innerHTML = '';
  desktopContainer.innerHTML = '';
  
  const role = localStorage.getItem('aura_user_role') || 'buyer';

  Object.keys(routes).forEach(route => {
    if (!routes[route].showInNav) return;

    // Filter routes based on role
    if (role !== 'seller' && route === 'seller_dashboard') return;
    if (role === 'seller' && route !== 'seller_dashboard') return;

    // Mobile nav
    const item = document.createElement('a');
    item.className = 'nav-item flex flex-col items-center justify-center transition-all group cursor-pointer';
    item.id = `nav-${route}`;
    item.innerHTML = `
      <span class="material-symbols-outlined" data-icon="${routes[route].icon}">${routes[route].icon}</span>
      <span class="font-['Space_Grotesk'] text-[10px] uppercase font-medium tracking-tighter mt-1">${routes[route].label}</span>
    `;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (route === 'evidence') {
        startNewClaim();
        return;
      }
      navigate(route);
    });
    navContainer.appendChild(item);

    // Desktop nav
    const dItem = document.createElement('a');
    dItem.className = 'font-["Space_Grotesk"] py-1 transition-colors cursor-pointer desktop-nav-item';
    dItem.id = `desktop-nav-${route}`;
    dItem.innerText = routes[route].label;
    dItem.addEventListener('click', (e) => {
      e.preventDefault();
      if (route === 'evidence') {
        startNewClaim();
        return;
      }
      navigate(route);
    });
    desktopContainer.appendChild(dItem);
  });
}

function setupTopBarActions() {
  const notificationsButton = document.getElementById('notifications-button');
  const logoutButton = document.getElementById('account-logout-btn');
  const logoutModal = document.getElementById('logout-modal');
  const logoutCancelButton = document.getElementById('logout-cancel-btn');
  const logoutConfirmButton = document.getElementById('logout-confirm-btn');
  if (!notificationsButton || !logoutButton || !logoutModal || !logoutCancelButton || !logoutConfirmButton) return;

  const closeLogoutModal = () => {
    logoutModal.classList.add('hidden');
  };

  const openLogoutModal = () => {
    logoutModal.classList.remove('hidden');
  };

  notificationsButton.addEventListener('click', () => {
    if (!state.currentUser) return;
    markNotificationsSeen(state.currentUserId);
    refreshNotificationIndicator();
    navigate('notifications');
  });

  logoutButton.addEventListener('click', () => {
    if (!state.currentUser) return;
    openLogoutModal();
  });

  logoutCancelButton.addEventListener('click', closeLogoutModal);

  logoutModal.addEventListener('click', (event) => {
    if (event.target === logoutModal) {
      closeLogoutModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLogoutModal();
    }
  });

  logoutConfirmButton.addEventListener('click', async () => {
    if (!state.currentUser) return;

    logoutConfirmButton.disabled = true;
    logoutCancelButton.disabled = true;
    logoutConfirmButton.textContent = 'Signing out...';

    try {
      await logout();
      state.currentRoute = 'hub';
      resetDraftClaim();
      localStorage.removeItem('aura_user_role');
      localStorage.removeItem('aura_user_id');
      sessionStorage.removeItem('is_new_user');
    } catch (error) {
      logoutConfirmButton.textContent = error.message || 'Logout failed';
    } finally {
      logoutConfirmButton.disabled = false;
      logoutCancelButton.disabled = false;
      logoutConfirmButton.textContent = 'Logout';
      closeLogoutModal();
      updateAccountUi();
    }
  });
}

function setupDragScroll() {
  const appContent = document.getElementById('app-content');
  const interactiveSelector = 'button, a, input, select, textarea, label, [role="button"]';
  let isDragging = false;
  let startY = 0;
  let startScrollY = 0;
  let moved = false;

  appContent.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(interactiveSelector)) return;

    isDragging = true;
    moved = false;
    startY = event.clientY;
    startScrollY = window.scrollY;
    appContent.classList.add('is-dragging');
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) > 3) {
      moved = true;
    }

    if (moved) {
      event.preventDefault();
      window.scrollTo({ top: startScrollY - deltaY, behavior: 'auto' });
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    appContent.classList.remove('is-dragging');
  });

  appContent.addEventListener('dragstart', (event) => {
    if (!event.target.closest(interactiveSelector)) {
      event.preventDefault();
    }
  });
}

function updateLayoutForRoute(route) {
  const navContainer = document.getElementById('bottom-nav');
  const desktopContainer = document.getElementById('desktop-nav');
  const appContent = document.getElementById('app-content');
  const showNav = Boolean(state.currentUser && routes[route]?.showNav);

  navContainer.classList.toggle('is-hidden', !showNav);
  navContainer.setAttribute('aria-hidden', String(!showNav));
  desktopContainer.classList.toggle('md:hidden', !showNav);
  desktopContainer.classList.toggle('md:flex', showNav);
  desktopContainer.setAttribute('aria-hidden', String(!showNav));
  appContent.classList.toggle('nav-hidden', !showNav);
}

function renderAuthLoading() {
  const appContent = document.getElementById('app-content');
  const offlineCopy = navigator.onLine === false
    ? 'Anda sedang offline. Kami mencoba membuka sesi terakhir...'
    : 'Memeriksa sesi masuk...';
  appContent.innerHTML = `
    <div class="flex min-h-[calc(100dvh-120px)] items-center justify-center text-body-md text-on-surface-variant">
      ${offlineCopy}
    </div>
  `;
  updateLayoutForRoute('auth');
  updateAccountUi();
}

function updateAccountUi() {
  const accountAvatar = document.getElementById('account-avatar');
  const notificationsButton = document.getElementById('notifications-button');
  const notificationsBadge = document.getElementById('notifications-badge');
  const logoutButton = document.getElementById('account-logout-btn');
  if (!accountAvatar || !notificationsButton || !notificationsBadge || !logoutButton) return;

  const user = state.currentUser;
  const role = localStorage.getItem('aura_user_role') || 'buyer';
  const showNotifications = Boolean(user) && role !== 'seller';
  notificationsButton.disabled = !showNotifications;
  logoutButton.disabled = !user;
  notificationsButton.title = showNotifications ? 'Open notifications' : 'Notifications unavailable';
  logoutButton.title = user ? 'Logout' : 'Login required';
  logoutButton.classList.toggle('hidden', !user);
  notificationsButton.classList.toggle('hidden', !showNotifications);
  if (!user) {
    notificationsBadge.classList.add('hidden');
  }

  const initial = (user?.email || 'A').trim().charAt(0).toUpperCase();
  accountAvatar.innerHTML = `
    <span class="material-symbols-outlined text-[30px]" style="font-variation-settings: 'FILL' 1;">person</span>
  `;
  accountAvatar.setAttribute('aria-label', user ? `${initial} profile` : 'Guest profile');
}

export function updateDraftClaim(patch) {
  state.draftClaim = {
    ...state.draftClaim,
    ...patch
  };
  persistDraftClaim(state.draftClaim);
}

export function setCurrentClaim(claim) {
  state.currentClaim = claim;
}

export function setCurrentClaimStatus(status) {
  state.currentClaimStatus = status;
}

export function resetDraftClaim() {
  const previewUrl = state.draftClaim?.evidencePreviewUrl;
  if (previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl);
  }
  state.draftClaim = {
    ...DEFAULT_DRAFT_CLAIM
  };
  clearDraftClaimPersistence();
}

export function startNewClaim() {
  state.currentClaim = null;
  state.currentClaimStatus = null;
  resetDraftClaim();
  navigate('evidence');
}

export function navigate(route, params = null) {
  if (route === 'auth') {
    updateLayoutForRoute(route);
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'auto' });
    appContent.appendChild(renderAuthScreen({ configError: state.authError }));
    return;
  }

  if (!state.authReady) {
    renderAuthLoading();
    return;
  }

  if (!state.currentUser) {
    navigate('auth');
    return;
  }

  if (!routes[route]) return;

  if (route === 'notifications' && state.currentUserId) {
    markNotificationsSeen(state.currentUserId);
  }
  
  state.currentRoute = route;
  
  // Update nav UI (mobile)
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('text-indigo-400', 'drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]');
    el.classList.add('text-white/40', 'hover:text-white');
    const iconSpan = el.querySelector('.material-symbols-outlined');
    if(iconSpan) iconSpan.style.fontVariationSettings = "'FILL' 0";
  });
  const activeNav = document.getElementById(`nav-${route}`);
  if (activeNav) {
    activeNav.classList.remove('text-white/40', 'hover:text-white');
    activeNav.classList.add('text-indigo-400', 'drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]');
    const activeIconSpan = activeNav.querySelector('.material-symbols-outlined');
    if(activeIconSpan) activeIconSpan.style.fontVariationSettings = "'FILL' 1";
  }

  // Update desktop UI
  document.querySelectorAll('.desktop-nav-item').forEach(el => {
    el.classList.remove('text-indigo-400', 'border-b-2', 'border-indigo-500');
    el.classList.add('text-white/60', 'hover:bg-white/5');
  });
  const activeDesktopNav = document.getElementById(`desktop-nav-${route}`);
  if (activeDesktopNav) {
    activeDesktopNav.classList.remove('text-white/60', 'hover:bg-white/5');
    activeDesktopNav.classList.add('text-indigo-400', 'border-b-2', 'border-indigo-500');
  }

  // Hide nav bar if route dictates
  updateLayoutForRoute(route);
  
  // Update content
  const appContent = document.getElementById('app-content');
  appContent.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'auto' });
  
  // Render new content
  const screenContent = routes[route].render(params);
  appContent.appendChild(screenContent);

  refreshNotificationIndicator();
  updateConnectivityBanner();
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
