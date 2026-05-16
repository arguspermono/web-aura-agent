import { navigate, state } from '../main.js';
import { fetchClaims } from '../services/api_service.js';
import {
  formatCurrency,
  getClaimAmount,
  normalizeClaimStatus,
  sortClaimsByUpdatedAt,
  toTitleCase
} from './claim_ui.js';
import { renderCardSkeleton, renderNetworkState } from './ui_states.js';

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'review', label: 'Review' },
  { key: 'rejected', label: 'Rejected' }
];

function formatRelativeTime(value) {
  if (!value) return 'Just now';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) return 'Just now';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getNotificationMeta(claim) {
  const normalizedStatus = normalizeClaimStatus(claim.status);
  const claimTypeLabel = toTitleCase(claim.claim_type);
  const claimLabel = claim.id ? `#${String(claim.id).slice(0, 8)}` : claimTypeLabel;
  const amount = formatCurrency(getClaimAmount(claim));
  const explanation = claim.ai_explanation?.trim();

  if (normalizedStatus === 'approved') {
    return {
      type: 'approved',
      title: 'Claim Approved',
      accent: 'bg-secondary shadow-[0_0_10px_rgba(0,110,42,0.35)]',
      iconWrap: 'bg-secondary-container',
      iconColor: 'text-on-secondary-container',
      icon: 'check_circle',
      unread: true,
      body: `${claimLabel} for ${claimTypeLabel} was approved with refund ${amount}.`
    };
  }

  if (normalizedStatus === 'review') {
    return {
      type: 'review',
      title: 'Manual Review Needed',
      accent: 'bg-amber-500',
      iconWrap: 'bg-amber-100',
      iconColor: 'text-amber-700',
      icon: 'shield',
      unread: true,
      body: explanation || `${claimLabel} for ${claimTypeLabel} needs manual review from the seller.`
    };
  }

  if (normalizedStatus === 'rejected') {
    return {
      type: 'rejected',
      title: 'Claim Rejected',
      accent: 'bg-error shadow-[0_0_10px_rgba(186,26,26,0.25)]',
      iconWrap: 'bg-error-container/80',
      iconColor: 'text-error',
      icon: 'block',
      unread: true,
      body: explanation || `${claimLabel} for ${claimTypeLabel} was rejected after review.`
    };
  }

  if (claim.status === 'pending') {
    return {
      type: 'processing',
      title: 'Claim Submitted',
      accent: 'bg-primary',
      iconWrap: 'bg-primary-fixed',
      iconColor: 'text-primary',
      icon: 'notifications',
      unread: false,
      body: `${claimLabel} for ${claimTypeLabel} has been submitted and is waiting for analysis.`
    };
  }

  if (claim.status === 'failed') {
    return {
      type: 'processing',
      title: 'Analysis Failed',
      accent: 'bg-error',
      iconWrap: 'bg-error-container/80',
      iconColor: 'text-error',
      icon: 'error',
      unread: true,
      body: explanation || `${claimLabel} for ${claimTypeLabel} could not be processed automatically.`
    };
  }

  return {
    type: 'processing',
    title: 'Analysis In Progress',
    accent: 'bg-primary',
    iconWrap: 'bg-primary-fixed',
    iconColor: 'text-primary',
    icon: 'schedule',
    unread: false,
    body: `${claimLabel} for ${claimTypeLabel} is at ${toTitleCase(claim.current_step || claim.status, 'Processing')}.`
  };
}

function toNotificationItem(claim) {
  const meta = getNotificationMeta(claim);

  return {
    id: `claim-${claim.id || claim.claim_id || claim.updated_at || claim.created_at || 'unknown'}`,
    time: formatRelativeTime(claim.updated_at || claim.created_at),
    ...meta
  };
}

function renderNotificationCard(item) {
  return `
    <div class="glass-panel p-md rounded-xl flex items-start gap-md hover:shadow-lg transition-all cursor-pointer relative overflow-hidden ${item.unread ? 'bg-white/70' : 'bg-white/65 opacity-90'} backdrop-blur-md border border-outline-variant">
      <div class="absolute left-0 top-0 bottom-0 w-1 ${item.accent}"></div>
      <div class="w-12 h-12 rounded-full ${item.iconWrap} flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined ${item.iconColor}" data-icon="${item.icon}" ${item.icon === 'check_circle' ? `style="font-variation-settings: 'FILL' 1;"` : ''}>${item.icon}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-base">
          <h3 class="font-title-sm text-on-surface">${item.title}</h3>
          <span class="font-label-caps text-on-surface-variant">${item.time}</span>
        </div>
        <p class="font-body-sm text-on-surface-variant">${item.body}</p>
      </div>
      ${item.unread ? '<div class="w-2 h-2 rounded-full bg-primary shrink-0 mt-2"></div>' : ''}
    </div>
  `;
}

function renderTabButton(tab, activeTab) {
  const isActive = tab.key === activeTab;
  return `
    <button
      type="button"
      data-tab="${tab.key}"
      class="notification-tab flex-1 py-2 px-4 rounded-full font-title-sm text-center transition-colors ${isActive ? 'bg-primary-container text-on-primary-container shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}"
    >
      ${tab.label}
    </button>
  `;
}

export function renderNotifications() {
  const container = document.createElement('div');
  container.className = 'w-full pb-6';

  let activeTab = 'all';
  let notificationItems = [];

  container.innerHTML = `
    <section class="mb-lg">
      <h2 class="font-display-lg text-display-lg text-on-surface">Notifications</h2>
      <p class="font-body-md text-on-surface-variant mt-xs">Live updates generated from your current claims.</p>
    </section>
    <nav id="notification-tabs" class="flex flex-wrap gap-2 p-1 bg-surface-container rounded-[1.25rem] mb-lg max-w-2xl"></nav>
    <div id="notifications-feed" class="grid gap-md">
      ${renderCardSkeleton(3)}
    </div>
    <div id="notifications-summary" class="p-md rounded-xl bg-gradient-to-br from-primary-container to-indigo-700 text-white shadow-xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-md">
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-xs">
          <span class="material-symbols-outlined text-white" data-icon="sync">sync</span>
          <span class="font-label-caps uppercase tracking-widest opacity-90">Claim Activity</span>
        </div>
        <h4 class="font-title-sm mb-base">Mengambil kabar terbaru</h4>
        <p id="notifications-summary-copy" class="font-body-sm opacity-80">Kami sedang memeriksa perubahan klaim terbaru.</p>
      </div>
      <div class="w-16 h-16 relative shrink-0">
        <svg class="w-full h-full transform -rotate-90">
          <circle class="text-white/20" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" stroke-width="4"></circle>
          <circle id="notifications-summary-ring" class="text-secondary-fixed" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" stroke-dasharray="176" stroke-dashoffset="176" stroke-width="4"></circle>
        </svg>
        <span id="notifications-summary-count" class="absolute inset-0 flex items-center justify-center font-label-caps">0</span>
      </div>
    </div>
  `;

  const tabsContainer = container.querySelector('#notification-tabs');
  const feed = container.querySelector('#notifications-feed');
  const summaryCopy = container.querySelector('#notifications-summary-copy');
  const summaryCount = container.querySelector('#notifications-summary-count');
  const summaryRing = container.querySelector('#notifications-summary-ring');

  const render = () => {
    tabsContainer.innerHTML = tabs.map((tab) => renderTabButton(tab, activeTab)).join('');

    const filtered = activeTab === 'all'
      ? notificationItems
      : notificationItems.filter((item) => item.type === activeTab);

    feed.innerHTML = filtered.length
      ? filtered.map(renderNotificationCard).join('')
      : `
        <div class="glass-panel rounded-xl border border-outline-variant bg-white/70 p-md text-body-md text-on-surface-variant">
          No ${activeTab} notifications yet.
        </div>
      `;
  };

  fetchClaims(state.currentUserId)
    .then((claims) => {
      const sortedClaims = sortClaimsByUpdatedAt(claims);
      notificationItems = sortedClaims.map(toNotificationItem);

      const activeClaimCount = sortedClaims.filter((claim) => {
        const normalizedStatus = normalizeClaimStatus(claim.status);
        return normalizedStatus === 'review' || normalizedStatus === 'processing';
      }).length;
      const totalClaims = sortedClaims.length;
      const ringOffset = totalClaims ? Math.max(20, 176 - Math.round((activeClaimCount / totalClaims) * 176)) : 176;

      summaryCopy.textContent = totalClaims
        ? `${activeClaimCount} dari ${totalClaims} klaim masih menunggu proses atau perlu ditinjau.`
        : 'Belum ada aktivitas klaim. Notifikasi akan muncul setelah Anda membuat klaim.';
      summaryCount.textContent = `${totalClaims}`;
      summaryRing.setAttribute('stroke-dashoffset', String(ringOffset));

      render();
    })
    .catch((error) => {
      console.warn('Failed to load claim notifications', error);
      summaryCopy.textContent = 'Kabar terbaru belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.';
      feed.innerHTML = `
        ${renderNetworkState({
          title: 'Notifikasi belum bisa dimuat',
          body: 'Kami belum bisa mengambil notifikasi terbaru. Periksa koneksi internet, lalu coba lagi.',
          retryId: 'notifications-retry-btn'
        })}
      `;
      tabsContainer.innerHTML = tabs.map((tab) => renderTabButton(tab, activeTab)).join('');
      feed.querySelector('#notifications-retry-btn')?.addEventListener('click', () => navigate('notifications'));
    });

  tabsContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.notification-tab');
    if (!button || !tabsContainer.contains(button)) return;

    activeTab = button.dataset.tab;
    render();
  });

  return container;
}
