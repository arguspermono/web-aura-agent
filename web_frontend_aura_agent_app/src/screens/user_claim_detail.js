import { navigate, state } from '../main.js';
import { getClaim, resolveEvidenceUrl } from '../services/api_service.js';
import { getStatusMeta, toTitleCase, formatCurrency, getClaimAmount } from './claim_ui.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown date';
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function renderDecisionBadge(aiDecision) {
  if (!aiDecision) return '';
  const config = {
    AUTO_APPROVE: { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: 'verified', label: 'Auto Approved' },
    REJECT:       { color: 'text-red-600 bg-red-50 border-red-200',             icon: 'block',    label: 'Rejected' },
    NEEDS_REVIEW: { color: 'text-amber-600 bg-amber-50 border-amber-200',        icon: 'shield',   label: 'Under Review' },
  };
  const c = config[aiDecision] || config.NEEDS_REVIEW;
  return `
    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-label-sm font-semibold ${c.color}">
      <span class="material-symbols-outlined text-[15px]" style="font-variation-settings:'FILL' 1">${c.icon}</span>
      ${c.label}
    </span>`;
}

export function renderUserClaimDetail(claimId) {
  const id = claimId || state.selectedClaimId;
  const container = document.createElement('div');
  container.className = 'w-full pb-8 max-w-2xl mx-auto';

  container.innerHTML = `
    <div class="flex items-center gap-4 pt-4 px-4 md:px-0">
      <button id="uclaim-back-btn"
        class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-variant/50 text-on-surface hover:bg-surface-variant transition-colors shrink-0">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h2 class="font-display-md text-display-md text-on-surface">Claim Detail</h2>
    </div>

    <div id="uclaim-content" class="mt-6 px-4 md:px-0 flex flex-col gap-5">
      <div class="flex items-center justify-center py-24 text-on-surface-variant gap-3">
        <span class="material-symbols-outlined animate-spin">progress_activity</span>
        <span class="text-body-md">Loading your claim…</span>
      </div>
    </div>
  `;

  container.querySelector('#uclaim-back-btn').addEventListener('click', () => navigate('user_claims'));

  // Fetch & render
  const content = container.querySelector('#uclaim-content');

  (async () => {
    try {
      const claim = await getClaim(id);
      if (!claim) throw new Error('Claim not found');

      const meta      = getStatusMeta(claim.status);
      const amount    = getClaimAmount(claim);
      const aiDecision = claim.ai_decision || '';
      const confidence = Math.round((claim.confidence_score || 0) * 100);
      const explanation = claim.ai_explanation || '';
      const rawUrl    = claim.evidence_url || claim.file_urls?.[0] || '';
      const evidenceData = rawUrl ? await resolveEvidenceUrl(rawUrl) : null;

      content.innerHTML = `

        <!-- Status card -->
        <div class="rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 backdrop-blur-md p-5 shadow-sm flex items-start justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-xl ${meta.iconBg} flex items-center justify-center ${meta.iconText} shrink-0">
              <span class="material-symbols-outlined text-[24px]" style="font-variation-settings:'FILL' 1">${meta.icon}</span>
            </div>
            <div class="min-w-0">
              <p class="font-title-sm text-on-surface">${toTitleCase(claim.claim_type)}</p>
              <p class="text-body-sm text-on-surface-variant mt-0.5">${formatDate(claim.created_at)}</p>
            </div>
          </div>
          <span class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold ${meta.iconText} ${meta.iconBg} border border-outline-variant/20">
            <span class="w-2 h-2 rounded-full ${meta.dot}"></span>
            ${meta.label}
          </span>
        </div>

        <!-- Evidence attachment -->
        <div class="rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 backdrop-blur-md overflow-hidden shadow-sm">
          <div class="flex items-center gap-3 border-b border-outline-variant/20 px-5 py-3.5 bg-surface-container-low/50">
            <span class="material-symbols-outlined text-primary text-[20px]">attachment</span>
            <span class="font-label-caps text-[11px] tracking-widest uppercase font-bold text-primary">Evidence Attachment</span>
          </div>
          <div class="p-4">
            ${evidenceData
              ? (evidenceData.type?.startsWith('video/')
                  ? `<video src="${escapeHtml(evidenceData.url)}" controls class="w-full rounded-xl object-contain max-h-72 bg-black/10"></video>`
                  : `<img src="${escapeHtml(evidenceData.url)}" alt="Evidence" class="w-full rounded-xl object-contain max-h-72 bg-surface-variant/20">`)
              : `<div class="flex flex-col items-center justify-center h-36 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container text-on-surface-variant gap-2">
                  <span class="material-symbols-outlined text-[36px]">hide_image</span>
                  <span class="text-body-sm">No evidence available</span>
                </div>`
            }
          </div>
        </div>

        <!-- Description -->
        <div class="rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 backdrop-blur-md p-5 shadow-sm">
          <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[14px]">description</span>
            Your Description
          </p>
          <p class="text-body-md text-on-surface-variant leading-relaxed bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20">
            ${escapeHtml(claim.text_description || claim.voice_description || 'No description provided.')}
          </p>
        </div>

        <!-- AI Analysis -->
        ${aiDecision ? `
        <div class="rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 backdrop-blur-md p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p class="text-[10px] font-bold text-outline uppercase tracking-[0.2em] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[14px]">memory</span>
              AI Analysis
            </p>
            ${renderDecisionBadge(aiDecision)}
          </div>
          ${confidence > 0 ? `
          <div class="flex items-center gap-3 mb-3">
            <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-700"
                   style="width: ${confidence}%"></div>
            </div>
            <span class="text-body-sm font-bold text-on-surface">${confidence}%</span>
          </div>
          ` : ''}
          ${explanation ? `
          <p class="text-body-md text-on-surface-variant leading-relaxed bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20">
            ${escapeHtml(explanation)}
          </p>` : ''}
        </div>` : ''}

        <!-- Refund value -->
        ${amount > 0 ? `
        <div class="rounded-2xl bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20 p-5 shadow-sm flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary text-[24px]" style="font-variation-settings:'FILL' 1">payments</span>
            <span class="text-body-md text-on-surface font-semibold">Refund Value</span>
          </div>
          <span class="font-display-sm text-primary font-black">${formatCurrency(amount)}</span>
        </div>` : ''}
      `;
    } catch (err) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-24 gap-4 text-on-surface-variant">
          <span class="material-symbols-outlined text-[48px] text-error/60">error</span>
          <p class="text-body-md text-center">Could not load claim details.<br><span class="text-body-sm">${escapeHtml(err.message)}</span></p>
          <button id="uclaim-retry" class="mt-2 px-5 py-2 rounded-full bg-primary text-on-primary text-body-sm font-semibold hover:opacity-90 transition">Retry</button>
        </div>`;
      content.querySelector('#uclaim-retry')?.addEventListener('click', () => navigate('user_claim_detail'));
    }
  })();

  return container;
}
