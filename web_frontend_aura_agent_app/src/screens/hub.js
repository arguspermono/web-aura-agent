import { navigate, startNewClaim, state } from '../main.js';
import { fetchClaims } from '../services/api_service.js';
import {
  formatCurrency,
  getClaimAmount,
  normalizeClaimStatus,
  renderClaimCard,
  sortClaimsByUpdatedAt
} from './claim_ui.js';
import { renderCardSkeleton, renderNetworkState } from './ui_states.js';

export function renderHub() {
  const container = document.createElement('div');
  container.className = 'w-full pb-4 sm:pb-6';
  const displayName = state.currentUsername || 'there';

  container.innerHTML = `
    <section class="flex flex-col gap-base">
      <p class="text-primary font-label-caps uppercase tracking-wider">Dashboard Overview</p>
      <h2 class="font-display-lg text-[clamp(2rem,8vw,3rem)] leading-tight text-on-background">Welcome, ${displayName}</h2>
    </section>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter mt-lg">
      <div class="md:col-span-8 glass-card rounded-xl p-md flex flex-col justify-between min-h-[220px] shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
        <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <p class="font-title-sm text-on-surface-variant mb-xs">Total Refund Requested</p>
            <h3 id="hub-total-value" class="text-[clamp(2.25rem,10vw,3rem)] font-bold tracking-tight text-on-surface">Loading...</h3>
            <p id="hub-approved-total" class="mt-2 text-body-md text-on-surface-variant">Approved Refund: Rp0</p>
          </div>
          <div id="hub-total-caption" class="flex items-center gap-xs px-sm py-xs bg-primary/10 rounded-full text-primary">
            <span class="material-symbols-outlined text-[18px]">query_stats</span>
            <span class="font-label-caps">Connecting</span>
          </div>
        </div>
        <div class="mt-lg grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-surface-container-low p-4">
            <p class="text-label-caps uppercase text-outline">Approved</p>
            <p id="hub-metric-approved" class="mt-2 text-headline-md text-secondary">0</p>
          </div>
          <div class="rounded-xl bg-surface-container-low p-4">
            <p class="text-label-caps uppercase text-outline">Review</p>
            <p id="hub-metric-review" class="mt-2 text-headline-md text-amber-600">0</p>
          </div>
          <div class="rounded-xl bg-surface-container-low p-4">
            <p class="text-label-caps uppercase text-outline">Rejected</p>
            <p id="hub-metric-rejected" class="mt-2 text-headline-md text-error">0</p>
          </div>
        </div>
      </div>

      <button id="hub-create-claim-btn" class="md:col-span-4 bg-primary-container text-on-primary-container rounded-xl p-md flex flex-col items-center justify-center gap-sm group hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-primary/20 w-full mt-gutter md:mt-0">
        <div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined text-[40px] text-white">add_circle</span>
        </div>
        <div class="text-center">
          <p class="font-title-sm text-white">Create New Claim</p>
          <p class="text-white/70 text-body-sm mt-base">AI-assisted filing process</p>
        </div>
      </button>

      <div class="md:col-span-12 flex flex-col gap-md mt-sm">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h4 class="font-headline-md text-headline-md text-on-background">Recent Claims</h4>
          <button id="hub-view-all-claims" class="text-primary font-title-sm flex items-center gap-base hover:underline" type="button">
            View All <span class="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
        <div id="hub-claims-list" class="flex flex-col gap-sm">
          ${renderCardSkeleton(2)}
        </div>
      </div>

      <div class="md:col-span-12 bg-surface-container-high/40 rounded-2xl p-lg border border-primary/10 flex flex-col md:flex-row items-center gap-lg mt-sm">
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
          <span class="material-symbols-outlined text-white text-[32px]">auto_awesome</span>
        </div>
        <div class="flex-1 text-center md:text-left">
          <h4 class="font-title-sm text-primary mb-xs">Aura AI Demo Tip</h4>
          <p class="text-body-md text-on-surface-variant max-w-2xl">
            Use one approved claim and one review or rejected claim in the same demo session so the dashboard shows all major backend states.
          </p>
        </div>
        <button class="w-full sm:w-auto px-lg py-sm bg-primary text-white rounded-full font-title-sm hover:bg-primary/90 transition-colors shrink-0" type="button" id="hub-cta-create-secondary">
          Start Claim
        </button>
      </div>
    </div>
  `;

  const btn = container.querySelector('#hub-create-claim-btn');
  const secondaryCreateButton = container.querySelector('#hub-cta-create-secondary');
  const viewAllButton = container.querySelector('#hub-view-all-claims');
  const claimsList = container.querySelector('#hub-claims-list');
  const totalValue = container.querySelector('#hub-total-value');
  const approvedTotal = container.querySelector('#hub-approved-total');
  const totalCaption = container.querySelector('#hub-total-caption');
  const approvedMetric = container.querySelector('#hub-metric-approved');
  const reviewMetric = container.querySelector('#hub-metric-review');
  const rejectedMetric = container.querySelector('#hub-metric-rejected');

  const goToCreate = () => startNewClaim();
  btn?.addEventListener('click', goToCreate);
  secondaryCreateButton?.addEventListener('click', goToCreate);
  viewAllButton?.addEventListener('click', () => navigate('user_claims'));

  fetchClaims(state.currentUserId)
    .then((claims) => {
      const sortedClaims = sortClaimsByUpdatedAt(claims);
      const approvedClaims = sortedClaims.filter((claim) => normalizeClaimStatus(claim.status) === 'approved');
      const reviewClaims = sortedClaims.filter((claim) => normalizeClaimStatus(claim.status) === 'review');
      const rejectedClaims = sortedClaims.filter((claim) => normalizeClaimStatus(claim.status) === 'rejected');
      const totalRequested = reviewClaims.reduce((sum, claim) => (
        sum + getClaimAmount(claim)
      ), 0);
      const approvedRefundTotal = approvedClaims.reduce((sum, claim) => sum + getClaimAmount(claim), 0);

      totalValue.textContent = formatCurrency(totalRequested);
      approvedTotal.textContent = `Approved Refund: ${formatCurrency(approvedRefundTotal)}`;
      totalCaption.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">dataset</span>
        <span class="font-label-caps">${sortedClaims.length} claims in history</span>
      `;
      approvedMetric.textContent = `${approvedClaims.length}`;
      reviewMetric.textContent = `${reviewClaims.length}`;
      rejectedMetric.textContent = `${rejectedClaims.length}`;

      if (!sortedClaims.length) {
        claimsList.innerHTML = `
          <div class="glass-card rounded-xl p-md text-body-md text-on-surface-variant">
            No claims yet for the demo user. Create one claim to populate this dashboard.
          </div>
        `;
        return;
      }

      claimsList.innerHTML = sortedClaims.slice(0, 4).map(renderClaimCard).join('');
    })
    .catch((error) => {
      console.warn('Failed to load dashboard claims', error);
      totalValue.textContent = 'Belum tersambung';
      totalCaption.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">wifi_off</span>
        <span class="font-label-caps">Coba lagi nanti</span>
      `;
      claimsList.innerHTML = `
        ${renderNetworkState({
          title: 'Klaim belum bisa dimuat',
          body: 'Kami belum bisa mengambil daftar klaim terbaru. Periksa koneksi internet, lalu coba lagi.',
          retryId: 'hub-retry-btn'
        })}
      `;
      claimsList.querySelector('#hub-retry-btn')?.addEventListener('click', () => navigate('hub'));
    });

  return container;
}
